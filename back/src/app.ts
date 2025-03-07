import express, { Express, Request } from "express";
import morgan from 'morgan';
import sourceRouter from "./routes/sources";
import TranscriptionRouter from "./routes/transcription";
const app: Express = express();
import cors from 'cors';
import { io } from "./socket";

app.use(cors());
app.use(express.json());
app.use(morgan('combined'))
morgan.token('body', (req: Request) => {
  return JSON.stringify(req.body)
})

app.use(morgan(':method :url :body'))
app.use(express.urlencoded({ extended: true }));
app.use('/',sourceRouter)
app.use('/',TranscriptionRouter(io))

export default app;