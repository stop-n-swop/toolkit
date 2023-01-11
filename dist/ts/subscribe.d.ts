import { Redis } from './cache';
type SubscribeBase = Record<string, any>;
export type Unsubscribe = () => void;
export interface SubscribeType<E extends SubscribeBase> {
    <K extends keyof E>(key: K, callback: (data: E[K]) => any): Unsubscribe;
    <K extends keyof E>(key: K, name: string, callback: (data: E[K]) => any): Unsubscribe;
    <K extends keyof E>(key: K, filter: (data: E[K]) => boolean, callback: (data: E[K]) => any): Unsubscribe;
    <K extends keyof E>(key: K, name: string, filter: (data: E[K]) => boolean, callback: (data: E[K]) => any): Unsubscribe;
}
export declare const makeSubscribe: <E extends SubscribeBase>(redis: Redis) => SubscribeType<E>;
export {};
