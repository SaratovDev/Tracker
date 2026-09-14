import { defineStore } from 'pinia'

let nextId = 1

export const useToastStore = defineStore('toast', {
  state: () => ({
    items: []
  }),
  actions: {
    show(message) {
      const id = nextId++
      this.items.push({ id, message })
      setTimeout(() => this.remove(id), 3000)
    },
    remove(id) {
      this.items = this.items.filter((t) => t.id !== id)
    }
  }
})
