import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Admin Paneli</h1>
      <Card>
        <CardHeader>
          <CardTitle>Sistem Durumu</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Genel metrikler ve yönetim araçları burada yer alacak.</div>
        </CardContent>
      </Card>
    </div>
  )
}

