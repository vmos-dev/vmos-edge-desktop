export class EventEmitter {
  private listeners = new Map<string, Set<Function>>()

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set())
    this.listeners.get(event)!.add(callback)
  }

  once(event: string, callback: Function) {
    const wrapper = (...args: any[]) => {
      callback(...args)
      this.off(event, wrapper)
    }
    this.on(event, wrapper)
  }

  off(event: string, callback: Function) {
    this.listeners.get(event)?.delete(callback)
  }

  emit(event: string, ...args: any[]) {
    const set = this.listeners.get(event)
    if (!set) return
    for (const fn of set) {
      try {
        fn(...args)
      } catch (e) {
        console.error(`EventEmitter '${event}' listener error`, e)
      }
    }
  }

  clear(event?: string) {
    if (event) this.listeners.delete(event)
    else this.listeners.clear()
  }
}
