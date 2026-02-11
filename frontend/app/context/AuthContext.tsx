'use client';
import { createContext, useContext, useEffect, useState } from "react";
import { jwtDecode } from "jwt-decode";

type User = {
    id: string,
    email: string,
    role: "admin" | "user";
};

type AuthContextType = {
    user: User | null;
    login: (token: string) => void;
    logout: () => void;
};

interface JwtPayload {
    id: string,
    email: string,
    role: 'admin' | 'user'
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    useEffect(() => {
        const token = sessionStorage.getItem("CollabAIToken");
        if (token) {
            const { id, email, role } = jwtDecode<JwtPayload>(token);
            setUser({ id: id, email: email, role: role });
        }
    }, []);

    const login = (token: string) => {
        sessionStorage.setItem("CollabAIToken", token); 
        const decoded = jwtDecode<User>(token);
        setUser(decoded);
    };
    const logout = () => {
        sessionStorage.removeItem("CollabAIToken"); 
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext)!;