import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

// Mock bad-words module before importing ModerationService
jest.mock('bad-words', () => {
  return jest.fn().mockImplementation(() => ({
    isProfane: jest.fn((text: string) => {
      const badWords = ['shit', 'fuck', 'damn', 'hell', 'ass', 'bullshit'];
      return badWords.some(word => text.toLowerCase().includes(word));
    }),
    clean: jest.fn((text: string) => {
      const badWords = ['shit', 'fuck', 'damn', 'hell', 'ass', 'bullshit'];
      let cleaned = text;
      badWords.forEach(word => {
        const regex = new RegExp(word, 'gi');
        cleaned = cleaned.replace(regex, '****');
      });
      return cleaned;
    }),
    addWords: jest.fn(),
  }));
});

// Mock openai module
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    moderations: {
      create: jest.fn(),
    },
  }));
});

import { ModerationService } from './moderation.service';

describe('ModerationService', () => {
  let service: ModerationService;

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    // No OpenAI key = test mode
    mockConfigService.get.mockReturnValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ModerationService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<ModerationService>(ModerationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('isTestMode', () => {
    it('should return true when no OpenAI API key is configured', () => {
      expect(service.isTestMode()).toBe(true);
    });
  });

  describe('hasProfanity', () => {
    it('should detect profanity in text', () => {
      expect(service.hasProfanity('This is a shit test')).toBe(true);
      expect(service.hasProfanity('This is clean text')).toBe(false);
    });

    it('should be case insensitive', () => {
      expect(service.hasProfanity('DAMN this is bad')).toBe(true);
    });
  });

  describe('cleanProfanity', () => {
    it('should replace profanity with asterisks', () => {
      const result = service.cleanProfanity('What the hell is this');
      expect(result).not.toContain('hell');
      expect(result).toContain('****');
    });

    it('should not modify clean text', () => {
      const cleanText = 'This is perfectly clean text';
      expect(service.cleanProfanity(cleanText)).toBe(cleanText);
    });
  });

  describe('moderate', () => {
    it('should flag profane content in test mode', async () => {
      const result = await service.moderate('This is fucking terrible');

      expect(result.flagged).toBe(true);
      expect(result.profanityDetected).toBe(true);
      expect(result.flags).toContain('profanity');
      expect(result.testMode).toBe(true);
    });

    it('should not flag clean content', async () => {
      const result = await service.moderate('This is a perfectly normal comment');

      expect(result.flagged).toBe(false);
      expect(result.profanityDetected).toBe(false);
      expect(result.flags).toHaveLength(0);
      expect(result.testMode).toBe(true);
    });

    it('should return null categories in test mode', async () => {
      const result = await service.moderate('Test content');
      expect(result.categories).toBeNull();
    });
  });

  describe('shouldFlag', () => {
    it('should return true for flagged content', async () => {
      const result = await service.shouldFlag('This is bullshit');
      expect(result).toBe(true);
    });

    it('should return false for clean content', async () => {
      const result = await service.shouldFlag('Good morning world');
      expect(result).toBe(false);
    });
  });

  describe('getCategoryDescriptions', () => {
    it('should return category descriptions', () => {
      const descriptions = service.getCategoryDescriptions();

      expect(descriptions).toHaveProperty('hate');
      expect(descriptions).toHaveProperty('sexual');
      expect(descriptions).toHaveProperty('violence');
      expect(descriptions).toHaveProperty('profanity');
    });
  });
});
