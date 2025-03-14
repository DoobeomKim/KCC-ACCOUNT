export const dynamic = 'force-dynamic'

export default async function Home() {
  return Response.redirect(new URL('/de/auth/login', 'http://localhost:3000'))
}
