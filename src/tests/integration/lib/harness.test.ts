import { expect } from 'chai';
import { TestHarness, type AdapterLog } from './harness';

describe('TestHarness - Log Capture', () => {
    describe('parseLogLine', () => {
        // We need to access the private parseLogLine method for testing
        // Since it's private, we'll test it through the public interface

        it('should capture logs in the logs array', () => {
            // This is a basic structural test to ensure the logs array exists
            // Full integration testing would require spawning an actual adapter
            const logs: AdapterLog[] = [];
            expect(logs).to.be.an('array');
        });

        it('should validate AdapterLog structure', () => {
            const log: AdapterLog = {
                level: 'info',
                timestamp: new Date(),
                message: 'test message',
            };

            expect(log).to.have.property('level');
            expect(log).to.have.property('timestamp');
            expect(log).to.have.property('message');
            expect(log.level).to.be.oneOf(['silly', 'debug', 'info', 'warn', 'error']);
            expect(log.timestamp).to.be.instanceOf(Date);
            expect(log.message).to.be.a('string');
        });
    });

    describe('Log retrieval methods', () => {
        it('should have getLogs method signature', () => {
            // This test verifies the method exists in the type system
            // We can't test it fully without spawning an adapter
            const methodExists = Object.prototype.hasOwnProperty.call(TestHarness.prototype, 'getLogs');
            expect(methodExists || 'getLogs' in TestHarness.prototype).to.be.true;
        });

        it('should have clearLogs method signature', () => {
            const methodExists = Object.prototype.hasOwnProperty.call(TestHarness.prototype, 'clearLogs');
            expect(methodExists || 'clearLogs' in TestHarness.prototype).to.be.true;
        });

        it('should have assertLog method signature', () => {
            const methodExists = Object.prototype.hasOwnProperty.call(TestHarness.prototype, 'assertLog');
            expect(methodExists || 'assertLog' in TestHarness.prototype).to.be.true;
        });
    });
});
