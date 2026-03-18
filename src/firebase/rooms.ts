import { collection, doc, getDoc, updateDoc, onSnapshot, query, where, addDoc, serverTimestamp, getDocs, type FieldValue, type Timestamp } from 'firebase/firestore';
import { db } from './config';
import { type GameState } from '../engine/types';

export interface Room {
    id: string;
    creatorId: string;
    creatorName: string;
    passcode: string; // empty string if no passcode
    status: 'waiting' | 'playing' | 'finished';
    playerCount: number; // target max players (2-4)
    players: {
        uid: string;
        name: string;
        isAi: boolean;
        aiDifficulty?: string;
    }[];
    playerUids: string[];
    lastUpdatedByUid?: string;
    gameState?: GameState;
    gameStatePayload?: string;
    createdAt: FieldValue | Timestamp | null;
}

export const createRoom = async (
    creatorId: string,
    creatorName: string,
    passcode: string,
    playerCount: number
): Promise<string> => {
    const existing = await getActiveRoomForUser(creatorId);
    if (existing) throw new Error("You are already in an active room");

    const roomRef = await addDoc(collection(db, 'rooms'), {
        creatorId,
        creatorName,
        passcode,
        status: 'waiting',
        playerCount,
        players: [{ uid: creatorId, name: creatorName, isAi: false }],
        playerUids: [creatorId],
        createdAt: serverTimestamp()
    });
    return roomRef.id;
};

export const joinRoom = async (
    roomId: string,
    uid: string,
    name: string,
    passcode?: string
): Promise<void> => {
    const roomRef = doc(db, 'rooms', roomId);
    const roomSnap = await getDoc(roomRef);
    
    if (!roomSnap.exists()) throw new Error('Room not found');
    const roomData = roomSnap.data() as Room;

    if (roomData.status !== 'waiting') throw new Error('Room is no longer waiting for players');
    if (roomData.players.length >= roomData.playerCount) throw new Error('Room is full');
    if (roomData.passcode && roomData.passcode !== passcode) throw new Error('Incorrect passcode');

    // Check if already in room
    if (roomData.players.find(p => p.uid === uid)) return;

    const existing = await getActiveRoomForUser(uid);
    if (existing) throw new Error("You are already in an active room");

    await updateDoc(roomRef, {
        players: [...roomData.players, { uid, name, isAi: false }],
        playerUids: [...(roomData.playerUids || []), uid]
    });
};

export const addAiToRoom = async (
    roomId: string,
    aiName: string,
    difficulty: string
): Promise<void> => {
    const roomRef = doc(db, 'rooms', roomId);
    const roomSnap = await getDoc(roomRef);
    if (!roomSnap.exists()) throw new Error('Room not found');
    const roomData = roomSnap.data() as Room;

    if (roomData.players.length >= roomData.playerCount) throw new Error('Room is full');

    await updateDoc(roomRef, {
        players: [...roomData.players, { uid: `ai_${Date.now()}`, name: aiName, isAi: true, aiDifficulty: difficulty }]
    });
};

export const startGameInRoom = async (
    roomId: string,
    initialGameState: GameState
): Promise<void> => {
    const roomRef = doc(db, 'rooms', roomId);
    await updateDoc(roomRef, {
        status: 'playing',
        gameStatePayload: JSON.stringify(initialGameState)
    });
};

export const updateRoomGameState = async (
    roomId: string,
    gameState: GameState,
    uid: string
): Promise<void> => {
    const roomRef = doc(db, 'rooms', roomId);
    await updateDoc(roomRef, { gameStatePayload: JSON.stringify(gameState), lastUpdatedByUid: uid });
};

// Hook/callback for listening to room lobby list
export const listenToRooms = (callback: (rooms: Room[]) => void) => {
    const q = query(collection(db, 'rooms'), where('status', '==', 'waiting'));
    return onSnapshot(q, (snapshot) => {
        const rooms: Room[] = [];
        snapshot.forEach(doc => {
            rooms.push({ id: doc.id, ...doc.data() } as Room);
        });
        callback(rooms);
    });
};

// Hook/callback for listening to a specific room
export const listenToRoom = (roomId: string, callback: (room: Room | null) => void) => {
    return onSnapshot(doc(db, 'rooms', roomId), (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            const room: Room = { id: docSnap.id, ...data } as Room;
            if (data.gameStatePayload) {
                try {
                    room.gameState = JSON.parse(data.gameStatePayload);
                } catch (e) {
                    console.error("Failed to parse game state payload", e);
                }
            }
            callback(room);
        } else {
            callback(null);
        }
    });
};

export const getActiveRoomForUser = async (uid: string): Promise<Room | null> => {
    // Check waiting or playing rooms where the user is part of playerUids
    const roomsQuery = query(
        collection(db, 'rooms'),
        where('playerUids', 'array-contains', uid),
        where('status', 'in', ['waiting', 'playing'])
    );
    const snap = await getDocs(roomsQuery);
    if (!snap.empty) {
        const docSnap = snap.docs[0];
        const data = docSnap.data();
        const room: Room = { id: docSnap.id, ...data } as Room;
        if (data.gameStatePayload) {
            try {
                room.gameState = JSON.parse(data.gameStatePayload);
            } catch (e) {
                console.error("Failed to parse game state payload", e);
            }
        }
        return room;
    }
    return null;
};

export const leaveWaitingRoom = async (roomId: string, uid: string): Promise<void> => {
    const roomRef = doc(db, 'rooms', roomId);
    const roomSnap = await getDoc(roomRef);
    if (!roomSnap.exists()) return;
    const roomData = roomSnap.data() as Room;

    const newPlayers = roomData.players.filter(p => p.uid !== uid);
    const newPlayerUids = (roomData.playerUids || []).filter(id => id !== uid);
    const isCreator = roomData.creatorId === uid;

    if (isCreator || newPlayerUids.length === 0) {
        // Creator left or everyone left — terminate room so joiners get kicked
        await updateDoc(roomRef, { status: 'finished', players: newPlayers, playerUids: [] });
    } else {
        await updateDoc(roomRef, { players: newPlayers, playerUids: newPlayerUids });
    }
};

export const quitActiveGame = async (roomId: string, uid: string, newState: GameState): Promise<void> => {
    const roomRef = doc(db, 'rooms', roomId);
    const roomSnap = await getDoc(roomRef);
    if (!roomSnap.exists()) return;
    const roomData = roomSnap.data() as Room;

    const newPlayerUids = (roomData.playerUids || []).filter(id => id !== uid);
    const hasHumans = Object.values(newState.playerTypes).some(type => type === 'human');
    
    if (!hasHumans || newPlayerUids.length === 0) {
        await updateDoc(roomRef, { 
            status: 'finished', 
            playerUids: [], 
            gameStatePayload: JSON.stringify(newState),
            lastUpdatedByUid: uid
        });
    } else {
        await updateDoc(roomRef, { 
            playerUids: newPlayerUids,
            gameStatePayload: JSON.stringify(newState), 
            lastUpdatedByUid: uid
        });
    }
};

export const leaveFinishedRoom = async (roomId: string, uid: string): Promise<void> => {
    const roomRef = doc(db, 'rooms', roomId);
    const roomSnap = await getDoc(roomRef);
    if (!roomSnap.exists()) return;
    const roomData = roomSnap.data() as Room;

    const newPlayerUids = (roomData.playerUids || []).filter(id => id !== uid);

    if (newPlayerUids.length === 0) {
        await updateDoc(roomRef, { status: 'finished', playerUids: newPlayerUids });
    } else {
        await updateDoc(roomRef, { playerUids: newPlayerUids });
    }
};
