import { Router } from 'express';
import multer from 'multer';
import sharp from 'sharp';

import { serverConfig } from '../../constants/env';
import { AccountEmailManager } from '../../emails/account.email';
import { userAuthMiddleware } from '../../middlewares/auth.middleware';
import { LanguageHelper } from '../../utils/LanguageHelper';
import { RouterHelper } from '../../utils/RouterHelper';
import { TextHelper } from '../../utils/TextHelper';
import { User } from './user.model';

// @ts-ignore
const userRouter = new Router();

// load auth middleware for adding into specific routes!

/*#############################################################|
|  >>> PUBLIC ROUTES
*##############################################################*/

// Authentication ========================================

// User => Login

interface ILoginData {
  email: string;
  password: string;
}

userRouter.post("/users/login", async (req, res) => {
  const { email, password }: ILoginData = req.body;

  const preparedEmail = TextHelper.stringPrepare(email);

  console.log(`logging user: ${preparedEmail}`);

  try {
    const user = await User.findByCredentials(preparedEmail, password);
    const token = await user.generateAuthToken();

    return res.status(200).send({
      user,
      token
    });
  } catch (error) {
    console.log(`ERROR: ${error}`);
    res.status(400).send({
      error: error.toString()
    });
  }
});

// User => Sign Up
userRouter.post("/users", async (req, res) => {
  const { name, email, password } = req.body;

  //force lowercase and trim
  const preparedEmail = TextHelper.stringPrepare(email);

  const user = new User({
    name,
    preparedEmail,
    password
  });

  try {
    await user.save();

    const token = await user.generateAuthToken();

    console.log(`User created: ${user.email}`);

    const accountEmailManager = new AccountEmailManager();

    // sample email
    accountEmailManager.newAccount(
      "jfurtado141@gmail.com",
      "Hello World!",
      "welcome",
      {
        name: "Joao",
        login_url: "http://appboilerplate.com/login",
        username: "joaouser",
        trial_start_date: "2019-11-09",
        trial_end_date: "2019-11-29",
        trial_length: 30,
        support_email: serverConfig.email.supportEmail,
        action_url: "https://someactionurl.com"
      }
    );

    return res.status(201).send({
      user,
      token
    });
  } catch (error) {
    res.status(400).send({
      status: "error",
      message: LanguageHelper.getLanguageString("user", "userCreationError"),
      details: error.message
    });
  }
});

/*#############################################################|
|  >>> PROTECTED ROUTES
*##############################################################*/

// Authentication routes ========================================

// User ==> Logout
userRouter.post("/users/logout", userAuthMiddleware, async (req, res) => {
  const { user } = req;
  const reqToken = req.token;

  try {
    // remove the token that's being used for the user from our user tokens array in our database
    user.tokens = user.tokens.filter(tokenObj => tokenObj.token !== reqToken);

    console.log(`Logging out user: ${user.email}`);

    await user.save(); // save user model to update records

    return res.status(200).send({
      status: "success",
      message: LanguageHelper.getLanguageString("user", "userLogoutSuccess")
    });
  } catch (error) {
    return res.status(400).send({
      status: "error",
      message: LanguageHelper.getLanguageString("user", "userLogoutError"),
      details: error.message
    });
  }
});

// User ==> Logout all connected devices

userRouter.post("/users/logout/all", userAuthMiddleware, async (req, res) => {
  const { user } = req;

  try {
    user.tokens = [];

    await user.save();

    return res.status(200).send({
      status: "success",
      message: LanguageHelper.getLanguageString("user", "userLogoutAllSuccess")
    });
  } catch (error) {
    console.log(error);
    return res.status(500).send({
      status: "error",
      message: LanguageHelper.getLanguageString("user", "userLogoutAllError"),
      details: error.message
    });
  }
});

// User ==> Upload profile picture

const upload = multer({
  // multer (upload library) configuration

  limits: {
    fileSize: 1000000 // 1.000.000 bytes = 1 mb
  },
  fileFilter(req, file, cb) {
    // file type restriction

    console.log(`received file ${file.originalname}`);

    if (!file.originalname.match(/\.(png|jpeg|jpg)$/)) {
      // reject file callback
      return cb(
        new Error(
          LanguageHelper.getLanguageString(
            "user",
            "userErrorFileUploadFormat",
            {
              format: "png or jpg"
            }
          )
        )
      );
    }

    cb(undefined, true); // acccept file callback
  }
});

// !upload-key should match postman's form-data key. set key as 'file' instead of text
userRouter.post(
  "/profile/avatar",
  [userAuthMiddleware, upload.single("avatar")],
  async (req, res) => {
    console.log("uploading your file...");

    // here we're saving the file directly in our database
    const { user } = req;
    const { buffer } = req.file;

    // Let's use sharp library to change the file (crop, change format, etc)

    const editedImageBuffer = await sharp(buffer)
      .resize({
        width: 250,
        height: 250
      })
      .png()
      .toBuffer();

    user.avatar = editedImageBuffer;
    await user.save();

    return res.status(200).send({
      status: "success",
      message: LanguageHelper.getLanguageString("user", "userAvatarUploaded")
    });
  },
  (error, req, res, next) => {
    return res.status(500).send({
      status: "error",
      message: LanguageHelper.getLanguageString(
        "user",
        "userAvatarErrorUpload"
      ),
      details: error.message
    });
  }
);

// CRUD routes ========================================

// User => Serve avatar picture ========================================

userRouter.get("/user/:id/profile", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user || !user.avatar) {
      return res.status(500).send({
        status: "error",
        message: LanguageHelper.getLanguageString(
          "user",
          "userAvatarUploadEmpty"
        )
      });
    }

    res.set("Content-Type", "image/png");

    return res.send(user.avatar);
  } catch (error) {
    return res.status(404).send();
  }
});

// User => Delete avatar picture ========================================

userRouter.delete("/users/profile/me", userAuthMiddleware, async (req, res) => {
  try {
    const { user } = req;

    user.avatar = undefined;
    user.save();

    return res.status(200).send({
      status: "success",
      message: LanguageHelper.getLanguageString(
        "user",
        "userAvatarUploadDeleted"
      )
    });
  } catch (error) {
    res.status(400).send({
      status: "error",
      message: LanguageHelper.getLanguageString(
        "user",
        "userAvatarUploadDeletedError"
      ),
      details: error.message
    });
  }
});

// User ==> Delete your own account

userRouter.delete("/users/me", userAuthMiddleware, async (req, res) => {
  const { user } = req;

  try {
    await user.remove();

    return res.status(200).send(user);
  } catch (error) {
    console.log(error);
    return res.status(500).send({
      status: "error",
      message: LanguageHelper.getLanguageString("user", "userDeleteError"),
      details: error.message
    });
  }
});

userRouter.get("/users/profile", userAuthMiddleware, async (req, res) => {
  const { user } = req;

  try {
    return res.status(200).send({
      user
    }); // req.user is coming from the authMiddleware
  } catch (error) {
    return res.status(500).send({
      status: "error",
      message: LanguageHelper.getLanguageString("user", "userProfileGetError"),
      details: error.message
    });
  }
});

userRouter.patch("/users/me", userAuthMiddleware, async (req, res) => {
  const { user } = req;
  const updates = Object.keys(req.body);

  if (
    !RouterHelper.isAllowedKey(req.body, ["name", "email", "password", "age"])
  ) {
    return res.status(400).send({
      status: "error",
      message: LanguageHelper.getLanguageString(
        "user",
        "userPatchForbiddenKeys"
      )
    });
  }
  try {
    // update every key on the user object
    updates.forEach(update => {
      user[update] = req.body[update];
    });
    await user.save();

    // const user = await User.findByIdAndUpdate(id, req.body, {
    //   new: true, //return updated user
    //   runValidators: true //run our standard validators on update
    // });

    return res.status(200).send(user);
  } catch (error) {
    console.log(error);
    return res.status(400).send({
      status: "error",
      message: LanguageHelper.getLanguageString("user", "userFailedUpdate"),
      details: error.message
    });
  }
});

export { userRouter };
