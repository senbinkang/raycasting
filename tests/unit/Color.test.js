import { describe, it, expect } from 'vitest'
import { Color } from '../../src/engine/utils/Color.js'

describe('Color', () => {
    describe('constructor', () => {
        it('should create a color with r, g, b values', () => {
            const c = new Color(255, 128, 64)
            expect(c.r).toBe(255)
            expect(c.g).toBe(128)
            expect(c.b).toBe(64)
            expect(c.a).toBe(1)
        })

        it('should create a color with alpha value', () => {
            const c = new Color(255, 128, 64, 0.5)
            expect(c.a).toBe(0.5)
        })
    })

    describe('static colors', () => {
        it('should have White color', () => {
            const c = Color.White
            expect(c.r).toBe(255)
            expect(c.g).toBe(255)
            expect(c.b).toBe(255)
            expect(c.a).toBe(1)
        })

        it('should have Black color', () => {
            const c = Color.Black
            expect(c.r).toBe(0)
            expect(c.g).toBe(0)
            expect(c.b).toBe(0)
        })

        it('should have Red color', () => {
            const c = Color.Red
            expect(c.r).toBe(255)
            expect(c.g).toBe(0)
            expect(c.b).toBe(0)
        })

        it('should have Green color', () => {
            const c = Color.Green
            expect(c.r).toBe(0)
            expect(c.g).toBe(255)
            expect(c.b).toBe(0)
        })

        it('should have Blue color', () => {
            const c = Color.Blue
            expect(c.r).toBe(0)
            expect(c.g).toBe(0)
            expect(c.b).toBe(255)
        })
    })

    describe('stringColor', () => {
        it('should return rgba string without alpha when alpha is 1', () => {
            const c = new Color(255, 128, 64)
            expect(c.stringColor()).toBe('rgba(255, 128, 64, 1)')
        })

        it('should return rgba string with alpha', () => {
            const c = new Color(255, 128, 64, 0.5)
            expect(c.stringColor()).toBe('rgba(255, 128, 64, 0.5)')
        })
    })

    describe('add', () => {
        it('should add two colors', () => {
            const c1 = new Color(100, 50, 25)
            const c2 = new Color(50, 25, 10)
            const result = c1.add(c2)
            expect(result.r).toBe(150)
            expect(result.g).toBe(75)
            expect(result.b).toBe(35)
            expect(result.a).toBe(2)
            expect(result).not.toBe(c1)
        })
    })
})
