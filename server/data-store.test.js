import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createBlobStore, createFileStore, createMemoryStore } from './data-store.js'

vi.mock('@vercel/blob', () => ({
  get: vi.fn(),
  put: vi.fn()
}))

const { get, put } = await import('@vercel/blob')

const DATA = { projects: [{ id: 'p1', name: 'Сайт', hourlyRate: 3000, createdAt: 1 }], tasks: [] }

beforeEach(() => {
  vi.clearAllMocks()
})

describe('createMemoryStore', () => {
  it('пустое хранилище возвращает null', async () => {
    expect(await createMemoryStore().read()).toBeNull()
  })

  it('сохраняет и отдаёт данные', async () => {
    const store = createMemoryStore()
    await store.write(DATA)

    expect(await store.read()).toEqual(DATA)
  })

  it('принимает начальное значение', async () => {
    expect(await createMemoryStore(DATA).read()).toEqual(DATA)
  })
})

describe('createFileStore', () => {
  let dir

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'tasktracker-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('возвращает null, если файла ещё нет', async () => {
    const store = createFileStore(join(dir, 'nested', 'data.json'))

    expect(await store.read()).toBeNull()
  })

  it('создаёт каталоги и переживает повторное чтение', async () => {
    const path = join(dir, 'nested', 'data.json')
    const store = createFileStore(path)

    await store.write(DATA)

    expect(await store.read()).toEqual(DATA)
    expect(await createFileStore(path).read()).toEqual(DATA)
  })

  it('не оставляет временный файл после записи', async () => {
    const path = join(dir, 'data.json')
    await createFileStore(path).write(DATA)

    expect(await readFile(path, 'utf8')).toBe(JSON.stringify(DATA))
    await expect(readFile(`${path}.tmp`, 'utf8')).rejects.toThrow()
  })

  it('падает с ошибкой на битом файле, а не отдаёт пустые данные', async () => {
    const path = join(dir, 'data.json')
    await writeFile(path, '{ это не json', 'utf8')

    await expect(createFileStore(path).read()).rejects.toThrow()
  })
})

describe('createBlobStore', () => {
  it('читает данные из закрытого blob без кеша', async () => {
    const stream = new Response(JSON.stringify(DATA)).body
    get.mockResolvedValue({ statusCode: 200, stream })

    const store = createBlobStore({ pathname: 'tasktracker/data.json' })

    expect(await store.read()).toEqual(DATA)
    expect(get).toHaveBeenCalledWith('tasktracker/data.json', {
      access: 'private',
      useCache: false
    })
  })

  it('возвращает null, если blob ещё не создан', async () => {
    get.mockResolvedValue(null)

    expect(await createBlobStore().read()).toBeNull()
  })

  it('возвращает null на 304 и на пустом теле', async () => {
    get.mockResolvedValue({ statusCode: 304, stream: null })
    expect(await createBlobStore().read()).toBeNull()

    get.mockResolvedValue({ statusCode: 200, stream: new Response('   ').body })
    expect(await createBlobStore().read()).toBeNull()
  })

  it('пишет один и тот же путь, перезаписывая его', async () => {
    put.mockResolvedValue({})

    await createBlobStore({ pathname: 'tasktracker/data.json' }).write(DATA)

    expect(put).toHaveBeenCalledWith(
      'tasktracker/data.json',
      JSON.stringify(DATA),
      expect.objectContaining({
        access: 'private',
        allowOverwrite: true,
        addRandomSuffix: false,
        contentType: 'application/json'
      })
    )
  })

  it('прокидывает токен, если он задан', async () => {
    get.mockResolvedValue(null)
    put.mockResolvedValue({})

    const store = createBlobStore({ token: 'vercel_blob_rw_test' })
    await store.read()
    await store.write(DATA)

    expect(get.mock.calls[0][1].token).toBe('vercel_blob_rw_test')
    expect(put.mock.calls[0][2].token).toBe('vercel_blob_rw_test')
  })
})
