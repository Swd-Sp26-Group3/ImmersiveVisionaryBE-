import app, { initializeApp } from './app'
import { config } from './config/config'
import { closeDbPool } from './config/database'

const startServer = async () => {
  try {
    // Initialize the application
    await initializeApp()

    // Start the server
    const server = app.listen(config.port, () => {
      console.log(`🚀 Server running on port ${config.port}`)
      console.log(`📊 Environment: ${config.nodeEnv}`)
      console.log(`🌐 CORS Origin: ${typeof config.cors.origin === 'function' ? 'dynamic (multi-origin)' : config.cors.origin}`)
    })

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      console.log(`\n📡 Received ${signal}. Starting graceful shutdown...`)

      server.close(async () => {
        console.log('🔌 HTTP server closed')

        try {
          await closeDbPool()
          console.log('✅ Graceful shutdown completed')
          process.exit(0)
        } catch (error) {
          console.error('❌ Error during shutdown:', error)
          process.exit(1)
        }
      })
    }

    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
    process.on('SIGINT', () => gracefulShutdown('SIGINT'))
  } catch (error) {
    console.error('❌ Failed to start server:', error)
    process.exit(1)
  }
}

// Start the server
startServer()
