export const AI_CONSTANTS = {
    // Score generating base constants
    FEATURES: {
        COMPLETION_BONUS_CITY: 10,
        COMPLETION_BONUS_ROAD: 5,
        // The points from the feature itself
        CONTEST_JOINED_FEATURE_MULTIPLIER: 1.5,
        CONTEST_SHARE_SELF_BONUS: 10,
        CONTEST_TAKEOVER_SELF_BONUS: 20,
        CONTEST_TAKEOVER_OPPONENT_LOSS_ADD: 15,
        // When placing a tile that helps an opponent WITHOUT taking part
        CONTEST_HELP_NO_SHARE_CITY_COMPLETION_PENALTY: 50,
        CONTEST_HELP_NO_SHARE_GENERIC_COMPLETION_PENALTY: 15,
        FIELD_MULTIPLIER: 3,
    },
    NOOB: {
        SELF_WEIGHT: 0.1,
        OPPONENT_WEIGHT: 0.0,
        MEEPLE_PLACEMENT_BONUS: 3.0
    }
};

export const AI_CONSTANTS_EXPERIMENT = {
    MEEPLE_PLACEMENT: [3, 1.5, 1, 0.5, 0.5, 0.5, 0.5],
    EXTRA_POINT_ONE_SIDE_CITY_PLAYER: 0.5,
    EXTRA_POINT_ONE_SIDE_CITY_NEUTRAL: 1,
}
