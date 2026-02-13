import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

const DATA_DIR = path.join(process.cwd(), 'data');
const AUTH_FILE = path.join(DATA_DIR, 'auth.json');
const JWT_SECRET = process.env.JWT_SECRET || 'mc-admin-secret-key-change-me';

// Default credentials
const DEFAULT_USER = 'admin';
const DEFAULT_PASS = 'admin123';

interface AuthData {
    username: string;
    passwordHash: string;
}

export class AuthService {
    private authData: AuthData | null = null;

    constructor() {
        this.init();
    }

    private async init() {
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }

        if (fs.existsSync(AUTH_FILE)) {
            try {
                const data = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8'));
                this.authData = data;
            } catch (error) {
                console.error('Failed to read auth file, resetting to defaults', error);
                await this.resetToDefaults();
            }
        } else {
            await this.resetToDefaults();
        }
    }

    private async resetToDefaults() {
        const passwordHash = await bcrypt.hash(DEFAULT_PASS, 10);
        this.authData = {
            username: DEFAULT_USER,
            passwordHash: passwordHash
        };
        this.saveAuthData();
    }

    private saveAuthData() {
        if (this.authData) {
            fs.writeFileSync(AUTH_FILE, JSON.stringify(this.authData, null, 2));
        }
    }

    public async login(password: string): Promise<string | null> {
        if (!this.authData) await this.init();
        
        // Check if data is loaded
        if (!this.authData) return null;

        const isValid = await bcrypt.compare(password, this.authData.passwordHash);
        
        if (isValid) {
            return jwt.sign({ username: this.authData.username }, JWT_SECRET, { expiresIn: '24h' });
        }
        return null;
    }

    public async changePassword(currentPassword: string, newPassword: string): Promise<boolean> {
        if (!this.authData) await this.init();
        if (!this.authData) return false;

        const isValid = await bcrypt.compare(currentPassword, this.authData.passwordHash);
        if (!isValid) return false;

        this.authData.passwordHash = await bcrypt.hash(newPassword, 10);
        this.saveAuthData();
        return true;
    }

    // Middleware
    public authenticateToken = (req: Request, res: Response, next: NextFunction) => {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (token == null) {
             res.status(401).json({ error: 'Unauthorized' });
             return;
        }

        jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
            if (err) {
                 res.status(403).json({ error: 'Forbidden' });
                 return;
            }
            (req as any).user = user;
            next();
        });
    };
}

export const authService = new AuthService();
