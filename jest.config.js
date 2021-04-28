module.exports = {
	displayName: 'unit test',
	preset: 'ts-jest',
	testEnvironment: 'node',
	testRunner: 'jest-circus/runner',
	testMatch: ['<rootDir>/tests/**/*.test.ts'],
	globals: {
		'ts-jest': {
			tsConfig: '<rootDir>/tests/tsconfig.json'
		}
	},
	coveragePathIgnorePatterns: [
		'<rootDir>/tests/lib/MockClient.ts',
		'<rootDir>/tests/lib/MockLanguage.ts',
		'<rootDir>/tests/lib/MockNumberSerializer.ts',
		'<rootDir>/tests/lib/MockObjectSerializer.ts',
		'<rootDir>/tests/lib/MockProvider.ts',
		'<rootDir>/tests/lib/MockStringSerializer.ts',
		'<rootDir>/tests/lib/Util.ts'
	]
};
