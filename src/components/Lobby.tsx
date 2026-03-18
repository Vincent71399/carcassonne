import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { type Room, listenToRooms, listenToRoom, createRoom, joinRoom, addAiToRoom, startGameInRoom } from '../firebase/rooms';
import { useTranslation } from 'react-i18next';
import { createInitialState } from '../engine/state';
import { type PlayerId, type PlayerType } from '../engine/types';
import { getActiveRoomForUser, leaveWaitingRoom } from '../firebase/rooms';

interface LobbyProps {
    onStartGame: (playerNames: Record<number, string>, playerTypes: Record<number, PlayerType>, roomId: string, isHost: boolean, localPlayerIds: PlayerId[]) => void;
    onBack: () => void;
}

export const Lobby: React.FC<LobbyProps> = ({ onStartGame, onBack }) => {
    const { user } = useAuth();
    const { t } = useTranslation();
    const [rooms, setRooms] = useState<Room[]>([]);
    const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
    const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
    const [view, setView] = useState<'list' | 'create' | 'room'>('list');

    // Create Room Form
    const [createPasscode, setCreatePasscode] = useState('');
    const [createCount, setCreateCount] = useState(2);
    
    // Join Room Form
    const [joinPasscode, setJoinPasscode] = useState('');
    const [selectedRoomToJoin, setSelectedRoomToJoin] = useState<Room | null>(null);

    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (user) {
            getActiveRoomForUser(user.uid).then(room => {
                if (room && room.status === 'waiting') {
                    setCurrentRoomId(room.id);
                    setView('room');
                }
            });
        }
    }, [user]);

    useEffect(() => {
        if (view === 'list') {
            const unsub = listenToRooms(setRooms);
            return () => unsub();
        }
    }, [view]);

    const alertMappedId = (idx: number) => (idx + 1) as PlayerId;

    useEffect(() => {
        if (currentRoomId) {
            const unsub = listenToRoom(currentRoomId, (room) => {
                if (!room) {
                    setError('Room was closed');
                    setView('list');
                    setCurrentRoomId(null);
                    setCurrentRoom(null);
                } else if (room.status === 'finished') {
                    setError('The host has closed the room.');
                    setView('list');
                    setCurrentRoomId(null);
                    setCurrentRoom(null);
                } else {
                    setCurrentRoom(room);
                    if (room.status === 'playing' && room.gameState) {
                        // Game started by creator!
                        const pNames: Record<number, string> = {};
                        const pTypes: Record<number, PlayerType> = {};
                        const localPlayerIds: PlayerId[] = [];
                        room.players.forEach((p, idx) => {
                            const pId = alertMappedId(idx);
                            pNames[pId] = p.name;
                            pTypes[pId] = p.isAi ? (p.aiDifficulty as PlayerType || 'ai-noob') : 'human';
                            if (p.uid === user?.uid) localPlayerIds.push(pId);
                        });
                        const isHost = room.creatorId === user?.uid;
                        onStartGame(pNames, pTypes, room.id, isHost, localPlayerIds);
                    }
                }
            });
            return () => unsub();
        }
    }, [currentRoomId, onStartGame, user?.uid]);

    const handleCreateRoom = async () => {
        if (!user) return;
        try {
            setError(null);
            const id = await createRoom(user.uid, user.displayName || user.email?.split('@')[0] || 'Player', createPasscode, createCount);
            setCurrentRoomId(id);
            setView('room');
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        }
    };

    const handleJoinClick = (room: Room) => {
        if (room.passcode) {
            setSelectedRoomToJoin(room);
        } else {
            submitJoin(room.id, '');
        }
    };

    const submitJoin = async (roomId: string, passcode: string) => {
        if (!user) return;
        try {
            setError(null);
            await joinRoom(roomId, user.uid, user.displayName || user.email?.split('@')[0] || 'Player', passcode);
            setCurrentRoomId(roomId);
            setView('room');
            setSelectedRoomToJoin(null);
            setJoinPasscode('');
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        }
    };

    const handleAddAi = async (difficulty: string) => {
        if (!currentRoomId || currentRoom?.creatorId !== user?.uid) return;
        try {
            setError(null);
            await addAiToRoom(currentRoomId, `AI ${difficulty}`, difficulty);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        }
    };

    const handleStartGame = async () => {
        if (!currentRoom || !currentRoomId || currentRoom.creatorId !== user?.uid) return;
        try {
            setError(null);
            const pNames: Record<number, string> = {};
            const pTypes: Record<number, PlayerType> = {};
            currentRoom.players.forEach((p, idx) => {
                const pId = alertMappedId(idx);
                pNames[pId] = p.name;
                pTypes[pId] = p.isAi ? (p.aiDifficulty as PlayerType || 'ai-noob') : 'human';
            });
            const initialState = createInitialState(pNames, pTypes);
            await startGameInRoom(currentRoomId, initialState);
            // The onSnapshot listener will trigger onStartGame for everyone including creator
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        }
    };

    const isFull = currentRoom && currentRoom.players.length >= currentRoom.playerCount;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
            {error && <div style={{ background: '#e74c3c', color: 'white', padding: '10px', borderRadius: '6px', fontSize: '14px' }}>{error}</div>}

            {view === 'list' && (
                <>
                    <h2 style={{ margin: 0, fontSize: '20px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        {t('lobby.rooms', 'Game Rooms')}
                        <button onClick={onBack} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.4)', color: 'white', padding: '4px 8px', borderRadius: '6px', cursor: 'pointer' }}>Back</button>
                    </h2>
                    
                    <button onClick={() => setView('create')} style={{ padding: '12px', background: '#2ecc71', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                        {t('lobby.createRoom', '+ Create New Room')}
                    </button>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '300px', overflowY: 'auto' }}>
                        {rooms.length === 0 ? (
                            <div style={{ textAlign: 'center', color: '#aaa', padding: '20px' }}>No rooms available. Create one!</div>
                        ) : rooms.map(room => (
                            <div key={room.id} style={{ background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontWeight: 'bold', color: 'white' }}>{room.creatorName}'s Room {room.passcode && '🔒'}</div>
                                    <div style={{ fontSize: '12px', color: '#ccc' }}>{room.players.length} / {room.playerCount} Players</div>
                                </div>
                                <button 
                                    onClick={() => handleJoinClick(room)}
                                    disabled={room.players.length >= room.playerCount}
                                    style={{ padding: '8px 16px', background: room.players.length >= room.playerCount ? '#555' : '#3498db', color: 'white', border: 'none', borderRadius: '6px', cursor: room.players.length >= room.playerCount ? 'not-allowed' : 'pointer' }}
                                >
                                    {room.players.length >= room.playerCount ? 'Full' : 'Join'}
                                </button>
                            </div>
                        ))}
                    </div>

                    {selectedRoomToJoin && (
                        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ background: '#2c3e50', padding: '20px', borderRadius: '12px', width: '300px', color: 'white' }}>
                                <h3>Enter Passcode</h3>
                                <input type="password" value={joinPasscode} onChange={e => setJoinPasscode(e.target.value)} style={{ width: '100%', padding: '10px', marginBottom: '15px', boxSizing: 'border-box' }} />
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button onClick={() => submitJoin(selectedRoomToJoin.id, joinPasscode)} style={{ flex: 1, padding: '10px', background: '#3498db', border: 'none', color: 'white', borderRadius: '6px', cursor: 'pointer' }}>Join</button>
                                    <button onClick={() => setSelectedRoomToJoin(null)} style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid #ccc', color: '#ccc', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}

            {view === 'create' && (
                <>
                    <h2 style={{ margin: 0, fontSize: '20px', color: '#fff' }}>Create Room</h2>
                    <label style={{ color: '#eee', fontSize: '14px' }}>Player Count</label>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        {[2, 3, 4].map(num => (
                            <button key={num} onClick={() => setCreateCount(num)} style={{ flex: 1, padding: '10px', background: createCount === num ? '#3498db' : 'rgba(0,0,0,0.3)', border: createCount === num ? 'none' : '1px solid #555', color: 'white', borderRadius: '6px', cursor: 'pointer' }}>{num}</button>
                        ))}
                    </div>
                    
                    <label style={{ color: '#eee', fontSize: '14px', marginTop: '10px' }}>Passcode (Optional)</label>
                    <input type="text" value={createPasscode} onChange={e => setCreatePasscode(e.target.value)} placeholder="Leave blank for public room" style={{ padding: '12px', borderRadius: '6px', border: 'none' }} />

                    <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                        <button onClick={handleCreateRoom} style={{ flex: 2, padding: '12px', background: '#2ecc71', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Create</button>
                        <button onClick={() => setView('list')} style={{ flex: 1, padding: '12px', background: 'transparent', color: '#ccc', border: '1px solid #ccc', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
                    </div>
                </>
            )}

            {view === 'room' && currentRoom && (
                <>
                    <h2 style={{ margin: 0, fontSize: '20px', color: '#fff', display: 'flex', justifyContent: 'space-between' }}>
                        Room: {currentRoom.creatorName}
                        {currentRoom.passcode && <span style={{ fontSize: '14px', background: 'rgba(0,0,0,0.5)', padding: '2px 8px', borderRadius: '4px' }}>🔒 {currentRoom.passcode}</span>}
                    </h2>

                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '15px', borderRadius: '8px' }}>
                        <div style={{ marginBottom: '10px', fontWeight: 'bold', color: '#ccc' }}>Players ({currentRoom.players.length}/{currentRoom.playerCount})</div>
                        {currentRoom.players.map((p, idx) => (
                            <div key={idx} style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'white', display: 'flex', justifyContent: 'space-between' }}>
                                <span>{p.name} {p.uid === currentRoom.creatorId && '👑'}</span>
                                {p.isAi && <span style={{ color: '#f1c40f', fontSize: '12px' }}>AI ({p.aiDifficulty})</span>}
                            </div>
                        ))}
                    </div>

                    {!isFull && currentRoom.creatorId === user?.uid && (
                        <div style={{ display: 'flex', gap: '5px', marginTop: '10px' }}>
                            <button onClick={() => handleAddAi('ai-noob')} style={{ flex: 1, padding: '8px', background: '#34495e', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>+ AI Noob</button>
                            <button onClick={() => handleAddAi('ai-easy')} style={{ flex: 1, padding: '8px', background: '#34495e', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>+ AI Easy</button>
                            <button onClick={() => handleAddAi('ai-medium')} style={{ flex: 1, padding: '8px', background: '#34495e', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>+ AI Med</button>
                        </div>
                    )}

                    {currentRoom.creatorId === user?.uid ? (
                        <button 
                            onClick={handleStartGame} 
                            disabled={!isFull}
                            style={{ padding: '16px', background: isFull ? '#2ecc71' : '#555', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '18px', cursor: isFull ? 'pointer' : 'not-allowed', marginTop: '10px' }}
                        >
                            {isFull ? 'Start Game' : 'Waiting for players...'}
                        </button>
                    ) : (
                        <div style={{ textAlign: 'center', color: '#f1c40f', padding: '16px', marginTop: '10px' }}>
                            Waiting for host to start the game...
                        </div>
                    )}

                    <button onClick={async () => { 
                        if (currentRoomId && user) {
                            await leaveWaitingRoom(currentRoomId, user.uid);
                        }
                        setView('list'); 
                        setCurrentRoomId(null); 
                    }} style={{ padding: '10px', background: 'transparent', color: '#e74c3c', border: '1px solid #e74c3c', borderRadius: '6px', cursor: 'pointer', marginTop: '10px' }}>
                        Leave Room
                    </button>
                </>
            )}
        </div>
    );
};
