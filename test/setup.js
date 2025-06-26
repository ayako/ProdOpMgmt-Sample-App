// Test setup file
require('dotenv').config({ path: '.env.test' });

// Mock console for cleaner test output
const originalConsole = global.console;
global.console = {
  ...originalConsole,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn()
};

// Reset mocks after each test
afterEach(() => {
  jest.clearAllMocks();
});