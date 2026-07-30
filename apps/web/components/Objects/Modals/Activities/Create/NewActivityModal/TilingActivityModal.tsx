import React, { useState } from 'react'
import * as Form from '@radix-ui/react-form'
import BarLoader from 'react-spinners/BarLoader'
import { Columns } from '@phosphor-icons/react'
import { constructAcceptValue } from '@/lib/constants'

const SUPPORTED_VIDEOS = constructAcceptValue(['mp4', 'webm'])
const SUPPORTED_PDF = constructAcceptValue(['pdf'])

function TilingModal({ submitTilingActivity, chapterId }: any) {
  const [video, setVideo] = React.useState<File | null>(null)
  const [pdf, setPdf] = React.useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [name, setName] = React.useState('')

  const handleSubmit = async (e: any) => {
    e.preventDefault()
    if (!video || !pdf) return
    setIsSubmitting(true)
    try {
      await submitTilingActivity({
        video,
        pdf,
        name,
        chapterId,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Form.Root onSubmit={handleSubmit} className="space-y-4">
      <div
        className="relative flex items-center justify-center h-20 rounded-xl overflow-hidden"
        style={{
          backgroundImage:
            'repeating-linear-gradient(90deg, transparent, transparent 6px, rgba(240,171,252,0.25) 6px, rgba(240,171,252,0.25) 7px), repeating-linear-gradient(0deg, transparent, transparent 6px, rgba(240,171,252,0.18) 6px, rgba(240,171,252,0.18) 7px)',
        }}
      >
        <span className="flex items-center gap-2 bg-white nice-shadow rounded-full px-4 py-1.5 text-sm font-medium text-gray-600">
          <Columns size={18} weight="duotone" className="text-fuchsia-400" />
          Conteúdo Dividido
        </span>
      </div>

      <div className="rounded-xl nice-shadow p-4 space-y-4">
        <Form.Field name="tiling-activity-name" className="space-y-1.5">
          <Form.Label className="text-sm font-medium text-gray-700">
            Nome da atividade
          </Form.Label>
          <Form.Message match="valueMissing" className="text-xs text-red-500">
            Forneça um nome
          </Form.Message>
          <Form.Control asChild>
            <input
              onChange={(e) => setName(e.target.value)}
              type="text"
              required
              placeholder="Digite um nome..."
              className="w-full h-9 px-3 text-sm rounded-lg bg-gray-50 border border-gray-200 outline-none focus:border-gray-300 focus:ring-1 focus:ring-gray-200 transition-colors"
            />
          </Form.Control>
        </Form.Field>

        <Form.Field name="tiling-activity-video" className="space-y-1.5">
          <Form.Label className="text-sm font-medium text-gray-700">
            Arquivo de vídeo (painel esquerdo)
          </Form.Label>
          <Form.Message match="valueMissing" className="text-xs text-red-500">
            Forneça um arquivo de vídeo
          </Form.Message>
          <Form.Control asChild>
            <input
              accept={SUPPORTED_VIDEOS}
              type="file"
              onChange={(e: any) => setVideo(e.target.files?.[0] ?? null)}
              required
              className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 transition-colors"
            />
          </Form.Control>
        </Form.Field>

        <Form.Field name="tiling-activity-pdf" className="space-y-1.5">
          <Form.Label className="text-sm font-medium text-gray-700">
            Arquivo PDF (painel direito)
          </Form.Label>
          <Form.Message match="valueMissing" className="text-xs text-red-500">
            Forneça um arquivo PDF
          </Form.Message>
          <Form.Control asChild>
            <input
              accept={SUPPORTED_PDF}
              type="file"
              onChange={(e: any) => setPdf(e.target.files?.[0] ?? null)}
              required
              className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 transition-colors"
            />
          </Form.Control>
        </Form.Field>
      </div>

      <div className="flex justify-end">
        <Form.Submit asChild>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center justify-center h-9 px-5 text-sm font-medium text-white bg-black rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {isSubmitting ? (
              <BarLoader
                cssOverride={{ borderRadius: 60 }}
                width={60}
                color="#ffffff"
              />
            ) : (
              'Criar atividade'
            )}
          </button>
        </Form.Submit>
      </div>
    </Form.Root>
  )
}

export default TilingModal
