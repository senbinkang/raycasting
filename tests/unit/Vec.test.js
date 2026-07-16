import { describe, it, expect } from 'vitest'
import { Vec } from '../../src/engine/utils/Vec.js'

describe('Vec', () => {
    describe('constructor', () => {
        it('should create a vector with x and y values', () => {
            const v = new Vec(3, 4)
            expect(v.x).toBe(3)
            expect(v.y).toBe(4)
        })
    })

    describe('len', () => {
        it('should return the magnitude of the vector', () => {
            const v = new Vec(3, 4)
            expect(v.len).toBe(5)
        })

        it('should return 0 for zero vector', () => {
            const v = new Vec(0, 0)
            expect(v.len).toBe(0)
        })

        it('should return correct magnitude for negative values', () => {
            const v = new Vec(-3, -4)
            expect(v.len).toBe(5)
        })
    })

    describe('add', () => {
        it('should add another vector', () => {
            const v1 = new Vec(1, 2)
            const v2 = new Vec(3, 4)
            const result = v1.add(v2)
            expect(v1.x).toBe(4)
            expect(v1.y).toBe(6)
            expect(result).toBe(v1)
        })
    })

    describe('sub', () => {
        it('should subtract another vector', () => {
            const v1 = new Vec(5, 7)
            const v2 = new Vec(3, 4)
            const result = v1.sub(v2)
            expect(v1.x).toBe(2)
            expect(v1.y).toBe(3)
            expect(result).toBe(v1)
        })
    })

    describe('mult', () => {
        it('should multiply by a scalar', () => {
            const v = new Vec(2, 3)
            const result = v.mult(2)
            expect(v.x).toBe(4)
            expect(v.y).toBe(6)
            expect(result).toBe(v)
        })

        it('should multiply by another vector', () => {
            const v1 = new Vec(2, 3)
            const v2 = new Vec(4, 5)
            const result = v1.mult(v2)
            expect(v1.x).toBe(8)
            expect(v1.y).toBe(15)
            expect(result).toBe(v1)
        })
    })

    describe('clone', () => {
        it('should create a copy of the vector', () => {
            const v1 = new Vec(3, 4)
            const v2 = v1.clone()
            expect(v2.x).toBe(3)
            expect(v2.y).toBe(4)
            expect(v2).not.toBe(v1)
        })

        it('should not be affected by changes to original', () => {
            const v1 = new Vec(3, 4)
            const v2 = v1.clone()
            v1.x = 5
            expect(v2.x).toBe(3)
        })
    })
})
