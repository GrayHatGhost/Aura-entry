import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminToken } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase'
import { cookies } from 'next/headers'

async function checkAuth() {
  const cookieStore = await cookies()
  const token = cookieStore.get('aura_admin')?.value
  if (!token) return false
  return verifyAdminToken(token)
}

// GET site content
export async function GET(req: NextRequest) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json({
      content: {
        main_text: 'Supabase henüz bağlı değil.\n\nLütfen .env.local dosyasını doldur.\n\nDaha sonra bu metin admin panelden düzenlenebilir.',
        subtitle: 'kurulum bekleniyor'
      }
    })
  }
  const supabase = createAdminClient()
  const { data } = await supabase.from('site_content').select('*').single()
  return NextResponse.json({ content: data })
}

// PUT — update content
export async function PUT(req: NextRequest) {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const supabase = createAdminClient()

  const dataToUpdate: any = {
    main_text: body.main_text,
    subtitle: body.subtitle,
    step1_btn1_label: body.step1_btn1_label,
    step1_btn2_label: body.step1_btn2_label,
    step1_btn3_label: body.step1_btn3_label,
    transition1_text: body.transition1_text,
    transition2_text: body.transition2_text,
    step2_text: body.step2_text,
    step2_btn1_label: body.step2_btn1_label,
    step2_btn2_label: body.step2_btn2_label,
    step2_btn3_label: body.step2_btn3_label,
    reveal_text: body.reveal_text,
    reveal_btn1_label: body.reveal_btn1_label,
    reveal_btn2_label: body.reveal_btn2_label,
    reveal_btn3_label: body.reveal_btn3_label,
    destroyed_text: body.destroyed_text,
    bg_music_url: body.bg_music_url,
    entry_btn_label: body.entry_btn_label,
    ban_confirm_text: body.ban_confirm_text,
    ban_pre_text: body.ban_pre_text,
    instagram_url: body.instagram_url,
    footer_text: body.footer_text,
    updated_at: new Date().toISOString()
  }

  Object.keys(dataToUpdate).forEach(key => dataToUpdate[key] === undefined && delete dataToUpdate[key])

  // fetch current row id first so we can upsert correctly
  const supabaseRead = createAdminClient()
  const { data: existing } = await supabaseRead.from('site_content').select('id').single()
  const id = existing?.id ?? 1

  const { error: upsertError } = await supabase
    .from('site_content')
    .upsert({ id, ...dataToUpdate })

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 400 })
  }

  return NextResponse.json({ status: 'updated' })
}
