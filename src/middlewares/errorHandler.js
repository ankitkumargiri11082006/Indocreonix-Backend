export function notFound(_req, res) {
  res.status(404).json({ message: 'Route not found' })
}

export function errorHandler(err, _req, res, _next) {
  if (err?.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ message: 'CV file size must be 2MB or less' })
  }

  if (err?.message === 'Only PDF CV files are allowed') {
    return res.status(400).json({ message: err.message })
  }

  const statusCode = err.statusCode || 500
  const message = err.message || 'Internal server error'

  res.status(statusCode).json({
    message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  })
}
