import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Login() {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { login } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const response = await axios.post('/api/login', { password });
            login(response.data.token);
            navigate('/');
        } catch (err: any) {
             setError(err.response?.data?.error || 'Login failed');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
            <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md border border-gray-700">
                <div className="flex justify-center mb-6">
                    <div className="p-3 bg-blue-600 rounded-full">
                        <Lock className="w-8 h-8 text-white" />
                    </div>
                </div>
                <h2 className="text-2xl font-bold text-white text-center mb-6">MC-Admin Login</h2>
                
                <div className="bg-blue-900/30 border border-blue-800 rounded p-4 mb-6">
                    <p className="text-blue-200 text-sm text-center">
                        Default Credentials:<br/>
                        User: <span className="font-mono font-bold">admin</span><br/>
                        Password: <span className="font-mono font-bold">admin123</span>
                    </p>
                </div>
                
                {error && (
                    <div className="bg-red-900/50 border border-red-800 text-red-200 p-3 rounded mb-4 text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-gray-300 text-sm font-bold mb-2">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-gray-700 border border-gray-600 text-white rounded p-3 focus:outline-none focus:border-blue-500"
                            placeholder="Enter password"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded transition duration-200 disabled:opacity-50"
                    >
                        {isLoading ? 'Logging in...' : 'Login'}
                    </button>
                </form>
            </div>
        </div>
    );
}
