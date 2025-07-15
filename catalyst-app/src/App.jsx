import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
    getAuth, 
    onAuthStateChanged, 
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut
} from 'firebase/auth';
import { 
    getFirestore, doc, getDoc, setDoc, onSnapshot, collection, addDoc, 
    deleteDoc, updateDoc, query, getDocs, writeBatch, enableIndexedDbPersistence 
} from 'firebase/firestore';
import Chart from 'chart.js/auto';
// import jsPDF from 'jspdf';
// import 'jspdf-autotable';

// --- Firebase Configuration ---
// CRITICAL: Replace this with your actual Firebase config object from your Firebase project.
const firebaseConfig = {
  apiKey: "AIzaSyAbj9hbMWxNjqZVDb748WnYO6CulC8Le4g"
    authDomain: "catalyst-1070a.firebaseapp.com"
    projectId: "catalyst-1070a"
    storageBucket: "catalyst-1070a.firebasestorage.app"
    messagingSenderId: "846726638572"
    appId: "1:846726638572:web:93e287e463c0e4654beec9"
};

const APP_ID = typeof __app_id !== 'undefined' ? __app_id : 'catalyst-react-app';

// --- Main App Component ---
export default function App() {
    const [view, setView] = useState('loading'); // loading, login, students, logging, dashboard, settings
    const [students, setStudents] = useState([]);
    const [behaviors, setBehaviors] = useState([]);
    const [settings, setSettings] = useState([]);
    const [currentStudent, setCurrentStudent] = useState(null);
    const [currentUser, setCurrentUser] = useState(null); // Will hold { uid, role, email }
    const [auth, setAuth] = useState(null);
    const [db, setDb] = useState(null);
    
    useEffect(() => {
        const app = initializeApp(firebaseConfig);
        const firebaseAuth = getAuth(app);
        const firestoreDb = getFirestore(app);
        
        setAuth(firebaseAuth);
        setDb(firestoreDb);
        
        enableIndexedDbPersistence(firestoreDb).catch((err) => {
            if (err.code === 'failed-precondition') {
                console.warn("Persistence failed: Multiple tabs open.");
            } else if (err.code === 'unimplemented') {
                console.warn("Persistence failed: Browser does not support it.");
            }
        });

        const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
            if (user) {
                const userRef = doc(firestoreDb, `artifacts/${APP_ID}/users`, user.uid);
                const userSnap = await getDoc(userRef);

                if (userSnap.exists()) {
                    setCurrentUser({ uid: user.uid, ...userSnap.data() });
                } else {
                    // First time user, create a profile with a default role
                    const newUserProfile = {
                        uid: user.uid,
                        email: user.email, // Use the email from the auth user
                        role: 'teacher', // Default role for new users
                        createdAt: new Date()
                    };
                    await setDoc(userRef, newUserProfile);
                    setCurrentUser(newUserProfile);
                }
                
                await setupInitialData(firestoreDb);
                setView('students');
            } else {
                // No user is signed in
                setCurrentUser(null);
                setView('login');
            }
        });

        return () => unsubscribe(); // Cleanup subscription on unmount
    }, []);

    useEffect(() => {
        if (!currentUser || !db) {
            setStudents([]); // Clear students if user logs out
            return;
        };

        const studentsQuery = query(collection(db, `artifacts/${APP_ID}/users/${currentUser.uid}/students`));
        const unsubscribeStudents = onSnapshot(studentsQuery, (snapshot) => {
            setStudents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        const behaviorsQuery = query(collection(db, `artifacts/${APP_ID}/public/data/behaviors`));
        const unsubscribeBehaviors = onSnapshot(behaviorsQuery, (snapshot) => {
            setBehaviors(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        const settingsQuery = query(collection(db, `artifacts/${APP_ID}/public/data/settings`));
        const unsubscribeSettings = onSnapshot(settingsQuery, (snapshot) => {
            setSettings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        return () => {
            unsubscribeStudents();
            unsubscribeBehaviors();
            unsubscribeSettings();
        };
    }, [currentUser, db]);

    const navigate = (viewName, student = null) => {
        setCurrentStudent(student);
        setView(viewName);
    };

    const handleSignOut = async () => {
        if (auth) {
            await signOut(auth);
        }
    };

    const renderView = () => {
        switch (view) {
            case 'loading':
                return <LoadingSpinner />;
            case 'login':
                return <LoginView auth={auth} />;
            case 'students':
                return <StudentSelectionView students={students} onSelectStudent={(student) => navigate('logging', student)} />;
            case 'logging':
                return <LoggingView student={currentStudent} behaviors={behaviors} settings={settings} db={db} currentUser={currentUser} onNavigate={navigate} />;
            case 'dashboard':
                return <DashboardView student={currentStudent} behaviors={behaviors} db={db} currentUser={currentUser} />;
            case 'settings':
                return <SettingsView students={students} behaviors={behaviors} settings={settings} db={db} currentUser={currentUser} />;
            case 'error':
                return <p className="text-red-500 text-center">An authentication error occurred. Please refresh the page.</p>;
            default:
                return <LoginView auth={auth} />;
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 text-gray-800 font-sans">
            <Header view={view} onNavigate={navigate} student={currentStudent} currentUser={currentUser} onSignOut={handleSignOut} />
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {renderView()}
            </main>
        </div>
    );
}

// --- Components ---

const Header = ({ view, onNavigate, student, currentUser, onSignOut }) => {
    const isStudentView = view === 'logging' || view === 'dashboard';
    return (
        <header className="bg-white shadow-md sticky top-0 z-40">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                <div className="flex items-center space-x-3">
                    <svg className="w-8 h-8 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 01-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 013.09-3.09L9 6l.813 2.846a4.5 4.5 0 013.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 01-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.898 20.572L16.5 21.75l-.398-1.178a3.375 3.375 0 00-2.455-2.456L12.75 18l1.178-.398a3.375 3.375 0 002.455-2.456L16.5 14.25l.398 1.178a3.375 3.375 0 002.456 2.456L20.25 18l-1.178.398a3.375 3.375 0 00-2.456 2.456z" /></svg>
                    <h1 className="text-2xl font-bold text-gray-900">Catalyst</h1>
                </div>
                {currentUser && (
                    <div className="flex items-center space-x-2">
                        {isStudentView ? (
                            <>
                                <button onClick={() => onNavigate('students')} className="px-3 py-2 rounded-md text-sm font-medium text-white bg-gray-600 hover:bg-indigo-700">Students</button>
                                <button onClick={() => onNavigate('logging', student)} className={`px-3 py-2 rounded-md text-sm font-medium text-white ${view === 'logging' ? 'bg-indigo-600' : 'bg-gray-600 hover:bg-indigo-700'}`}>Log</button>
                                <button onClick={() => onNavigate('dashboard', student)} className={`px-3 py-2 rounded-md text-sm font-medium text-white ${view === 'dashboard' ? 'bg-indigo-600' : 'bg-gray-600 hover:bg-indigo-700'}`}>Dashboard</button>
                            </>
                        ) : (
                            <>
                                <button onClick={() => onNavigate('students')} className={`px-3 py-2 rounded-md text-sm font-medium text-white ${view === 'students' ? 'bg-indigo-600' : 'bg-gray-600 hover:bg-indigo-700'}`}>Students</button>
                                <button onClick={() => onNavigate('settings')} className={`px-3 py-2 rounded-md text-sm font-medium text-white ${view === 'settings' ? 'bg-indigo-600' : 'bg-gray-600 hover:bg-indigo-700'}`}>Settings</button>
                            </>
                        )}
                    </div>
                )}
                <div className="text-xs text-gray-500 truncate">
                    {currentUser ? (
                        <div className="flex items-center space-x-4">
                             <span title={currentUser.email}>Role: <span className="font-semibold capitalize">{currentUser.role}</span></span>
                             <button onClick={onSignOut} className="text-indigo-600 hover:underline">Sign Out</button>
                        </div>
                    ) : 'Not Signed In'}
                </div>
            </div>
        </header>
    );
};

const LoadingSpinner = () => (
    <div className="text-center py-20">
        <svg className="animate-spin h-10 w-10 text-indigo-600 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
        <p className="mt-4 text-lg font-medium text-gray-600">Loading Catalyst...</p>
    </div>
);

const LoginView = ({ auth }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (err) {
            setError('Failed to sign in. Please check your email and password.');
            console.error(err);
        }
    };

    return (
        <div className="max-w-md mx-auto mt-10">
            <div className="bg-white p-8 rounded-xl shadow-lg">
                <h2 className="text-2xl font-bold text-center mb-6">Sign In to Catalyst</h2>
                <form onSubmit={handleLogin} className="space-y-6">
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email Address</label>
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                            required
                        />
                    </div>
                    {error && <p className="text-red-500 text-sm">{error}</p>}
                    <div>
                        <button type="submit" className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                            Sign In
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};


const StudentSelectionView = ({ students, onSelectStudent }) => (
    <div>
        <h2 className="text-3xl font-bold mb-6">Select Student</h2>
        {students.length === 0 ? (
            <p className="col-span-full text-center text-gray-500">No students found. Go to Settings to add your first student.</p>
        ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {students.map(student => (
                    <div key={student.id} onClick={() => onSelectStudent(student)} className="student-card bg-white rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300 cursor-pointer p-6 flex flex-col items-center justify-center text-center">
                        <div className="w-20 h-20 rounded-full bg-indigo-100 flex items-center justify-center mb-4">
                            <span className="text-3xl font-bold text-indigo-600">{student.name.charAt(0)}</span>
                        </div>
                        <h3 className="text-xl font-semibold text-gray-900">{student.name}</h3>
                    </div>
                ))}
            </div>
        )}
    </div>
);

const LoggingView = ({ student, behaviors, settings, db, currentUser, onNavigate }) => {
    const handleSave = async () => {
        alert("Incident saved! (Implementation pending)");
        onNavigate('dashboard', student);
    };

    return (
        <div>
            <h2 className="text-3xl font-bold mb-6">Logging for: <span className="text-indigo-600">{student.name}</span></h2>
            <p>Logging form UI would go here...</p>
            <button onClick={handleSave} className="mt-4 bg-green-600 text-white font-bold py-2 px-4 rounded-lg">Save Incident</button>
        </div>
    );
};

const DashboardView = ({ student, behaviors, db, currentUser }) => {
    const chartRef = useRef(null);
    const [incidents, setIncidents] = useState([]);

    useEffect(() => {
        if (!currentUser || !student) return;
        const incidentsQuery = query(collection(db, `artifacts/${APP_ID}/users/${currentUser.uid}/students/${student.id}/incidents`));
        getDocs(incidentsQuery).then(snapshot => {
            const data = snapshot.docs.map(doc => ({ ...doc.data(), timestamp: doc.data().timestamp.toDate() }));
            setIncidents(data);
        });
    }, [student, db, currentUser]);
    
    const generatePDF = () => {
        // const doc = new jsPDF();
        // doc.text(`Dashboard for ${student.name}`, 10, 10);
        // doc.autoTable({
        //     head: [['Behavior', 'Count']],
        //     body: [['Sample Behavior', '5']],
        // });
        // doc.save(`dashboard-${student.id}.pdf`);
        alert("PDF generation is temporarily disabled to fix a build issue.");
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold">Dashboard: <span className="text-indigo-600">{student.name}</span></h2>
                <button onClick={generatePDF} className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg disabled:bg-gray-400" disabled>Generate PDF</button>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-lg">
                <canvas ref={chartRef}></canvas>
                <p>Charts and incident logs would be displayed here.</p>
            </div>
        </div>
    );
};

const SettingsView = ({ students, behaviors, settings, db, currentUser }) => {
    return (
        <div>
            <h2 className="text-3xl font-bold mb-6">Settings</h2>
            <div className="space-y-12">
                {currentUser && currentUser.role === 'admin' && <UserManagement db={db} />}
                <div className="bg-white p-6 rounded-xl shadow-lg">
                    <h3 className="text-xl font-semibold mb-4">Manage Students</h3>
                    {/* Placeholder for student management */}
                </div>
                <div className="bg-white p-6 rounded-xl shadow-lg">
                    <h3 className="text-xl font-semibold mb-4">Manage Behaviors</h3>
                    {/* Placeholder for behavior management */}
                </div>
                 <div className="bg-white p-6 rounded-xl shadow-lg">
                    <h3 className="text-xl font-semibold mb-4">Manage Settings</h3>
                    {/* Placeholder for settings management */}
                </div>
            </div>
        </div>
    );
};

const UserManagement = ({ db }) => {
    const [allUsers, setAllUsers] = useState([]);

    useEffect(() => {
        const usersQuery = query(collection(db, `artifacts/${APP_ID}/users`));
        const unsubscribe = onSnapshot(usersQuery, (snapshot) => {
            setAllUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => unsubscribe();
    }, [db]);

    const handleRoleChange = async (userId, newRole) => {
        const userRef = doc(db, `artifacts/${APP_ID}/users`, userId);
        await updateDoc(userRef, { role: newRole });
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-lg">
            <h3 className="text-xl font-semibold mb-4">Manage Users</h3>
            <div className="space-y-2">
                {allUsers.map(user => (
                    <div key={user.id} className="flex justify-between items-center p-2 bg-gray-50 rounded-md">
                        <span className="truncate pr-4">{user.email || user.id}</span>
                        <select
                            value={user.role}
                            onChange={(e) => handleRoleChange(user.id, e.target.value)}
                            className="rounded-md border-gray-300 shadow-sm"
                        >
                            <option value="teacher">Teacher</option>
                            <option value="para">Para</option>
                            <option value="bis">BIS</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- Helper Functions ---
async function setupInitialData(db) {
    const settingsRef = doc(db, `artifacts/${APP_ID}/public/data/app_settings`, 'config');
    const settingsSnap = await getDoc(settingsRef);

    if (!settingsSnap.exists()) {
        console.log("First time setup: Seeding initial data...");
        const batch = writeBatch(db);
        
        const defaultBehaviors = [
            { name: 'Aggression', definition: 'Hitting, kicking, grabbing, etc.', type: 'frequency' },
            { name: 'Task Refusal', definition: 'Saying no, turning away, etc.', type: 'duration' },
            { name: 'Elopement', definition: 'Running out of assigned space.', type: 'duration' }
        ];
        const defaultSettings = ['Cafeteria', 'Classroom', 'Group Work', 'Hallway', 'Independent Work'];
        
        defaultBehaviors.forEach(b => {
            const newBehRef = doc(collection(db, `artifacts/${APP_ID}/public/data/behaviors`));
            batch.set(newBehRef, b);
        });
        defaultSettings.forEach(s => {
            const newSetRef = doc(collection(db, `artifacts/${APP_ID}/public/data/settings`));
            batch.set(newSetRef, { name: s });
        });

        batch.set(settingsRef, { initialized: true, version: '1.0' });
        await batch.commit();
    }
}
