import { MAX_QUEUE_SIZE } from '@jarvis-dcs/shared'

/**
 * Bounded FIFO queue. Drops oldest items on overflow.
 */
export class BoundedQueue<T> {
  private items: T[] = []
  private maxSize: number

  constructor(maxSize: number = MAX_QUEUE_SIZE) {
    this.maxSize = maxSize
  }

  push(item: T): void {
    if (this.items.length >= this.maxSize) {
      this.items.shift() // drop oldest
    }
    this.items.push(item)
  }

  shift(): T | undefined {
    return this.items.shift()
  }

  get size(): number {
    return this.items.length
  }

  clear(): void {
    this.items = []
  }
}
