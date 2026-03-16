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

export const uploadAvatarImage = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024,
  },
  fileFilter: (_req, file, callback) => {
    if (!file.mimetype?.startsWith('image/')) {
      callback(new Error('Only image files are allowed for profile picture'))
      return
    }

    callback(null, true)
  },
})

const allowedOrderDocumentMimes = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
])

const allowedOrderExtensions = ['.pdf', '.doc', '.docx', '.png', '.jpg', '.jpeg']

const orderDocumentsUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024,
    files: 4,
  },
  fileFilter: (_req, file, callback) => {
    const lowerName = file.originalname?.toLowerCase() || ''
    const hasAllowedExt = allowedOrderExtensions.some((extension) => lowerName.endsWith(extension))
    const hasAllowedMime = allowedOrderDocumentMimes.has(file.mimetype)

    if (!hasAllowedExt || !hasAllowedMime) {
      callback(new Error('Only PDF, DOC, DOCX, PNG and JPG files are allowed'))
      return
    }

    if (file.fieldname === 'prd' && !lowerName.endsWith('.pdf')) {
      callback(new Error('PRD must be uploaded as a PDF file'))
      return
    }

    callback(null, true)
  },
})

export const uploadOrderDocuments = orderDocumentsUpload.fields([
  { name: 'prd', maxCount: 1 },
  { name: 'supportingDocs', maxCount: 3 },
])
