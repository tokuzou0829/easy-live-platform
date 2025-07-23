import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { exec } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { serve } from '@hono/node-server'
import { promisify } from 'util'
import { showRoutes } from 'hono/dev'

const app = new Hono()

// Cache time (milliseconds)
const cacheTime = 60 * 1000

// Size map
const sizeMap = {
  sm: { height: 360 },
  md: { height: 720 },
  lg: { height: 1080 }
}

// Zod schema for query parameters
const querySchema = z.object({
  id: z.string().min(1),
  size: z.enum(['sm', 'md', 'lg']).default('md')
})

// Promisify exec
const execAsync = promisify(exec)

app.get('/api/thumbnail', zValidator('query', querySchema), async (c) => {
  try {
    const { id, size } = c.req.valid('query')
    const response = await fetch(`http://main-backend:3001/streams/${id}`, { method: 'GET' })
    if (!response.ok) {
      console.log(response.statusText)
      return c.text('ID Not Found', 400)
    }
    console.log("live is online")
    
    // Thumbnail directory
    const thumbnailDir = path.join(process.cwd(), 'thumbnails', id)
    const largeThumbnailFile = path.join(thumbnailDir, 'large_temp.jpg')
    const thumbnailFile = path.join(thumbnailDir, `${size}.jpg`)

    // Create thumbnail directory if it doesn't exist
    await fs.mkdir(thumbnailDir, { recursive: true })

    try {
      const stats = await fs.stat(largeThumbnailFile)
      if ((Date.now() - stats.mtimeMs) < cacheTime) {
        return await generateThumbnail(size, largeThumbnailFile, thumbnailFile, c)
      }
      await fs.unlink(largeThumbnailFile)
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.error(`Error accessing large thumbnail file: ${err.message}`)
        return c.text('Internal Server Error', 500)
      }
    }

    // `large`サムネイルが存在しない場合、生成
    const url = `http://nginx-rtmp/hls/${id}/index.m3u8`
    const ffmpegCommand = `ffmpeg -i "${url}" -vf "thumbnail,scale=-1:1080" -vframes 1 -q:v 2 ${largeThumbnailFile}`
    console.log("start exec")

    try {
      await execAsync(ffmpegCommand)
    } catch (error) {
      console.log(`Error executing FFmpeg: ${error.message}`)
      await fs.rmdir(thumbnailDir, { recursive: true })
      return c.text("Error generating large thumbnail", 500)
    }

    // `large`サイズのサムネイルを生成後、リサイズ処理を行う
    return await generateThumbnail(size, largeThumbnailFile, thumbnailFile, c)
  } catch (error) {
    console.error(error)
    return c.text('Internal Server Error', 500)
  }
})

async function generateThumbnail(size, largeThumbnailFile, thumbnailFile, c) {
  try {
    const stats = await fs.stat(thumbnailFile)
    if ((Date.now() - stats.mtimeMs) < cacheTime) {
      const fileBuffer = await fs.readFile(thumbnailFile)
      return c.newResponse(fileBuffer, 200, { 'Content-Type': 'image/jpeg' })
    }
    await fs.unlink(thumbnailFile)
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error(`Error accessing thumbnail file: ${err.message}`)
    }
  }

  try {
    await sharp(largeThumbnailFile)
      .resize({ height: sizeMap[size].height, fit: 'contain' })
      .toFile(thumbnailFile)
    const fileBuffer = await fs.readFile(thumbnailFile)
    return c.newResponse(fileBuffer, 200, { 'Content-Type': 'image/jpeg' })
  } catch (err) {
    console.error(`Error resizing image: ${err.message}`)
    return c.text("Error resizing thumbnail", 500)
  }
}

serve({
  fetch: app.fetch,
  port: 3003,
})
showRoutes(app)