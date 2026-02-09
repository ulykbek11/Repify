import * as Linking from 'expo-linking';

const config = {
    screens: {
        Login: 'login',
        Register: 'register',
        Main: {
            screens: {
                WorkoutTab: 'workout',
                ProfileTab: 'profile',
            },
        },
        Exercise: 'exercise',
        AnalysisResult: 'analysis/:id', // Example of parameter
        Leaderboard: 'leaderboard',
    },
};

const linking = {
    prefixes: [Linking.createURL('/'), 'repify://'],
    config,
};

export default linking;
