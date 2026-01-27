import { describe, expect, it } from 'vitest';
import { Rng } from '../../src/core/rng.js';

describe('Rng', () => {
  describe('determinism', () => {
    it('produces same sequence for same seed', () => {
      const rng1 = new Rng(12345);
      const rng2 = new Rng(12345);

      const seq1 = Array.from({ length: 100 }, () => rng1.nextU32());
      const seq2 = Array.from({ length: 100 }, () => rng2.nextU32());

      expect(seq1).toEqual(seq2);
    });

    it('produces different sequence for different seed', () => {
      const rng1 = new Rng(12345);
      const rng2 = new Rng(54321);

      const seq1 = Array.from({ length: 100 }, () => rng1.nextU32());
      const seq2 = Array.from({ length: 100 }, () => rng2.nextU32());

      expect(seq1).not.toEqual(seq2);
    });

    it('derived RNG is deterministic', () => {
      const rng1 = new Rng(42);
      const rng2 = new Rng(42);

      const derived1 = rng1.derive(5, 'agent-1');
      const derived2 = rng2.derive(5, 'agent-1');

      const seq1 = Array.from({ length: 50 }, () => derived1.nextU32());
      const seq2 = Array.from({ length: 50 }, () => derived2.nextU32());

      expect(seq1).toEqual(seq2);
    });

    it('different tick/agent produces different derived sequence', () => {
      const rng = new Rng(42);

      const derived1 = rng.derive(5, 'agent-1');
      const derived2 = rng.derive(5, 'agent-2');
      const derived3 = rng.derive(6, 'agent-1');

      const seq1 = Array.from({ length: 20 }, () => derived1.nextU32());
      const seq2 = Array.from({ length: 20 }, () => derived2.nextU32());
      const seq3 = Array.from({ length: 20 }, () => derived3.nextU32());

      expect(seq1).not.toEqual(seq2);
      expect(seq1).not.toEqual(seq3);
      expect(seq2).not.toEqual(seq3);
    });
  });

  describe('nextU32', () => {
    it('returns values in valid range', () => {
      const rng = new Rng(999);

      for (let i = 0; i < 1000; i++) {
        const value = rng.nextU32();
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(0xffffffff);
        expect(Number.isInteger(value)).toBe(true);
      }
    });
  });

  describe('nextFloat', () => {
    it('returns values in [0, 1)', () => {
      const rng = new Rng(888);

      for (let i = 0; i < 1000; i++) {
        const value = rng.nextFloat();
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
      }
    });

    it('produces roughly uniform distribution', () => {
      const rng = new Rng(777);
      const buckets = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      const samples = 10000;

      for (let i = 0; i < samples; i++) {
        const value = rng.nextFloat();
        const bucket = Math.floor(value * 10);
        if (buckets[bucket] !== undefined) buckets[bucket]++;
      }

      // Each bucket should have roughly 10% of samples
      const expected = samples / 10;
      for (const count of buckets) {
        expect(count).toBeGreaterThan(expected * 0.8);
        expect(count).toBeLessThan(expected * 1.2);
      }
    });
  });

  describe('nextInt', () => {
    it('returns values in [min, max]', () => {
      const rng = new Rng(666);

      for (let i = 0; i < 100; i++) {
        const value = rng.nextInt(5, 15);
        expect(value).toBeGreaterThanOrEqual(5);
        expect(value).toBeLessThanOrEqual(15);
        expect(Number.isInteger(value)).toBe(true);
      }
    });

    it('throws if min > max', () => {
      const rng = new Rng(555);
      expect(() => rng.nextInt(10, 5)).toThrow();
    });
  });

  describe('pickOne', () => {
    it('picks element from array', () => {
      const rng = new Rng(444);
      const arr = ['a', 'b', 'c', 'd', 'e'];

      for (let i = 0; i < 100; i++) {
        const picked = rng.pickOne(arr);
        expect(arr).toContain(picked);
      }
    });

    it('throws on empty array', () => {
      const rng = new Rng(333);
      expect(() => rng.pickOne([])).toThrow();
    });

    it('is deterministic', () => {
      const arr = [1, 2, 3, 4, 5];
      const rng1 = new Rng(222);
      const rng2 = new Rng(222);

      const picks1 = Array.from({ length: 50 }, () => rng1.pickOne(arr));
      const picks2 = Array.from({ length: 50 }, () => rng2.pickOne(arr));

      expect(picks1).toEqual(picks2);
    });
  });

  describe('weightedPick', () => {
    it('respects weights', () => {
      const rng = new Rng(111);
      const items = [
        { item: 'rare', weight: 1 },
        { item: 'common', weight: 99 },
      ];

      let rareCount = 0;
      const samples = 1000;

      for (let i = 0; i < samples; i++) {
        if (rng.weightedPick(items) === 'rare') {
          rareCount++;
        }
      }

      // Rare should be picked ~1% of the time
      expect(rareCount).toBeGreaterThan(0);
      expect(rareCount).toBeLessThan(50); // Very unlikely to exceed 5% with these weights
    });

    it('throws on empty array', () => {
      const rng = new Rng(100);
      expect(() => rng.weightedPick([])).toThrow();
    });

    it('throws on zero total weight', () => {
      const rng = new Rng(99);
      const items = [
        { item: 'a', weight: 0 },
        { item: 'b', weight: 0 },
      ];
      expect(() => rng.weightedPick(items)).toThrow();
    });
  });

  describe('shuffle', () => {
    it('returns all original elements', () => {
      const rng = new Rng(88);
      const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const shuffled = rng.shuffle([...arr]);

      expect(shuffled.sort((a, b) => a - b)).toEqual(arr);
    });

    it('is deterministic', () => {
      const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const rng1 = new Rng(77);
      const rng2 = new Rng(77);

      const shuffled1 = rng1.shuffle([...arr]);
      const shuffled2 = rng2.shuffle([...arr]);

      expect(shuffled1).toEqual(shuffled2);
    });

    it('actually shuffles elements', () => {
      const rng = new Rng(66);
      const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const shuffled = rng.shuffle([...arr]);

      // Very unlikely to be in original order
      expect(shuffled).not.toEqual(arr);
    });
  });

  describe('chance', () => {
    it('returns boolean', () => {
      const rng = new Rng(55);

      for (let i = 0; i < 100; i++) {
        const result = rng.chance(0.5);
        expect(typeof result).toBe('boolean');
      }
    });

    it('probability 0 always returns false', () => {
      const rng = new Rng(44);

      for (let i = 0; i < 100; i++) {
        expect(rng.chance(0)).toBe(false);
      }
    });

    it('probability 1 always returns true', () => {
      const rng = new Rng(33);

      for (let i = 0; i < 100; i++) {
        expect(rng.chance(1)).toBe(true);
      }
    });

    it('respects probability', () => {
      const rng = new Rng(22);
      let trueCount = 0;
      const samples = 1000;

      for (let i = 0; i < samples; i++) {
        if (rng.chance(0.3)) {
          trueCount++;
        }
      }

      // Should be around 30%
      expect(trueCount).toBeGreaterThan(200);
      expect(trueCount).toBeLessThan(400);
    });
  });

  describe('nextBool', () => {
    it('returns roughly 50/50 distribution', () => {
      const rng = new Rng(11);
      let trueCount = 0;
      const samples = 1000;

      for (let i = 0; i < samples; i++) {
        if (rng.nextBool()) {
          trueCount++;
        }
      }

      expect(trueCount).toBeGreaterThan(400);
      expect(trueCount).toBeLessThan(600);
    });
  });
});
