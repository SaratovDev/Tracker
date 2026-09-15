#!/usr/bin/env node
/**
 * Печатает значение SESSION_SECRET для .env и переменных окружения хостинга.
 * Секрет подписывает cookie сессии администратора: меняя его, вы разлогиниваете
 * все устройства.
 */
import { randomBytes } from 'node:crypto'

console.log(`SESSION_SECRET=${randomBytes(32).toString('hex')}`)
