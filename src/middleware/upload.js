import  multer from 'multer';

import path from 'path';

const storage = multer.diskStorage({


  destination: (req, file, cb) => {


    const folder = req.path.includes('review') ? 'uploads/reviews' : 'uploads/products';

    cb(null, folder);
  },
  filename: (req, file, cb) => {

    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9);

    cb(null, uniqueName + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {

  const allowedTypes = /jpeg|jpg|png|webp/;

  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());

  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'));
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } 
});

export default upload;
