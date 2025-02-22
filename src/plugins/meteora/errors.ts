export class MeteoraStatisticalBugError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'MeteoraStatisticalBugError';
    }
}
