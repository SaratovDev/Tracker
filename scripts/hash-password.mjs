import { hashPassword } from '../server/auth.js'

const password = process.argv[2]

if (!password) {
  console.error('Использование: npm run hash-password -- "ваш пароль"')
  process.exit(1)
}

console.log(`ADMIN_PASSWORD_HASH=${hashPassword(password)}`)
