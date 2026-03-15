import multer from 'multer'

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
})

export const uploadCvPdf = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024,
  },
  fileFilter: (_req, file, callback) => {
    const isPdfMime = file.mimetype === 'application/pdf'
    const isPdfName = file.originalname?.toLowerCase().endsWith('.pdf')

    if (!isPdfMime || !isPdfName) {
      callback(new Error('Only PDF CV files are allowed'))
      return
    }

    callback(null, true)
  },
})
