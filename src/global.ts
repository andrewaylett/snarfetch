import { Snarfetch } from './index';

let global: Snarfetch | null = null;

export const lookupGlobalInstance = () => {
    if (!global) {
        global = new Snarfetch();
    }
    return global;
};
