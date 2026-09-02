import express from 'express'
import { deployController } from '../controllers/controlpanelController.js'


const controlPanelRouter = express.Router()

controlPanelRouter.post("/deploy",deployController)


export default controlPanelRouter