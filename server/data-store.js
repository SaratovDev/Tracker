import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { get, put } from '@vercel/blob'

/** Один JSON-объект { projects, tasks } на всё приложение. */
export const DATA_PATHNAME = 'tasktracker/data.json'

/**
 * Хранилище в памяти: тесты и работа без внешнего сервиса.
 */
export function createMemoryStore(initial = null) {
  let value = initial

  return {
    name: 'memory',
    async read() {
      return value
    },
    async write(data) {
      value = data
    }
  }
}

/**
 * Хранилище в файле: используется dev-сервером, чтобы данные переживали
 * перезапуск. Запись через временный файл + rename — файл не побьётся,
 * если процесс упадёт посреди записи.
 */
export function createFileStore(filePath) {
  return {
    name: 'file',
    async read() {
      let raw
      try {
        raw = await readFile(filePath, 'utf8')
      } catch (err) {
        if (err.code === 'ENOENT') return null
        throw err
      }

      // Битый файл не подменяем пустыми данными молча: обнаружить это
      // лучше ошибкой, чем незаметной потерей задач.
      return JSON.parse(raw)
    },
    async write(data) {
      await mkdir(dirname(filePath), { recursive: true })
      const temporary = `${filePath}.tmp`
      await writeFile(temporary, JSON.stringify(data), 'utf8')
      await rename(temporary, filePath)
    }
  }
}

/**
 * Хранилище Vercel Blob.
 *
 * Blob закрытый (private) и читается через useCache: false — публичные
 * blob'ы кешируются CDN и отдавали бы устаревшие задачи.
 *
 * `token` нужен только вне Vercel: на самом хостинге доступ к подключённому
 * хранилищу выдаётся автоматически (OIDC), и передавать его не требуется.
 */
export function createBlobStore({ pathname = DATA_PATHNAME, token } = {}) {
  const credentials = token ? { token } : {}

  return {
    name: 'vercel-blob',
    async read() {
      const result = await get(pathname, {
        access: 'private',
        useCache: false,
        ...credentials
      })

      if (!result || result.statusCode !== 200 || !result.stream) return null

      const raw = await new Response(result.stream).text()
      return raw.trim() ? JSON.parse(raw) : null
    },
    async write(data) {
      await put(pathname, JSON.stringify(data), {
        access: 'private',
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: 'application/json',
        cacheControlMaxAge: 60,
        ...credentials
      })
    }
  }
}
