import { PrismaClient, Source, TaskType, Transcription } from "@prisma/client";
import { Request, Response, Router } from "express";
import { uniqueId } from "lodash";
import fs from "fs";
import { Server } from "socket.io";

const prisma = new PrismaClient();

const TranscriptionRouter = (io: Server) => {
  const router = Router();

  router.get("/transcription/:id?", async (req: Request, res: Response): Promise<any> => {
    const id = req.params.id ? parseInt(req.params.id) : undefined;
    try {
      if (id === undefined) {
        const transcriptions = await prisma.transcription.findMany();
        return res.status(200).json({ data: transcriptions });
      } else if (isNaN(id)) {
        throw new Error("Invalid ID");
      } else {
        const transcription = await prisma.transcription.findUnique({
          where: {
            id: id
          }
        });
        return res.status(200).json({ data: transcription });
      }
    } catch (error: any) {
      return res.status(400).json({ error: "Internal Server Error", details: error.message });
    }
  });

  router.post("/transcription", async (req: Request, res: Response): Promise<any> => {
    const sourceId = req.body.sourceId;

    const skipTranscription: boolean | undefined = req.body.skipTranscription

    try {
      if (!sourceId) {
        throw new Error("sourceId is required");
      }

      const source: Source | null = await prisma.source.findUnique({ where: { id: sourceId } });
      if (!source) {
        throw Error("Source not found");
      }

      const audioFile: string | null = source.audioUrl;
      if (!audioFile) {
        throw Error("Audio file not found");
      }
      const transcription: Transcription = await prisma.transcription.create({
        data: {
          sourceId: sourceId,
        }
      });

      // open audio file associated with the source and call whisper to restranscript it
      fs.openAsBlob(audioFile).then((audioFile: Blob) => {
        const formData = new FormData();
        formData.append("file", audioFile, "file.wav");
        if(!skipTranscription){
        fetch("http://whisper:8080/inference", {
          method: "POST",
          body: formData
        })
          .then(resp => resp.ok ? resp.json() : Promise.reject(resp))
          .then(res => {
            // use the response to update this transcription
            fetch(`http://localhost:4000/transcription/${transcription.id}`, {
              method: "PUT", 'headers': {
                'Content-Type': 'application/json'
              }, body: JSON.stringify({ content: JSON.stringify(res) })
            }).then((resp => resp.ok ? resp.json() : Promise.reject(resp))).then(res => console.log("transcription ended")).catch(error => error)
          })
          .catch(error => {
            console.error("Fetch error:", error);
            throw error;
          })}else{
            fetch(`http://localhost:4000/transcription/${transcription.id}`, {
              method: "PUT", 'headers': {
                'Content-Type': 'application/json'
              }, body: JSON.stringify({ content: "The flag skip transcription is set to true" })
            }).then((resp => resp.ok ? resp.json() : Promise.reject(resp))).then(res => res).catch(error => error)
          }
      })
      const task  = {type : TaskType.TRANSCRIPTION, transcriptionId : transcription.id}
      const taskId = await prisma.task.create({data : task})
      
      return res.status(201).json({ data: { sourceId: transcription.sourceId, taskId: taskId } });

    } catch (error: any) {
      return res.status(400).json({ error: "Internal Server Error", details: error.message });
    }
  });

  router.put("/transcription/:id?", async (req: Request, res: Response): Promise<any> => {
    const id = req.params.id ? parseInt(req.params.id) : undefined;
    try {
      if (id === undefined) {
        throw Error("transcription id must be provide")
      }
      const { content } = req.body as Transcription

      if (!content) {
        throw Error("content must be provide")
      }
      const transcription = await prisma.transcription.update({ where: { id: id }, data: { content: content } })
      return res.status(201).json({ data: transcription })

    } catch (error: any) {
      return res.status(400).json({ error: "Internal Server Error", details: error.message });
    }


  });

  router.delete("/transcription/:id?", async (req: Request, res: Response): Promise<any> => {
    const id = req.params.id ? parseInt(req.params.id) : undefined;
    try {
      if (id === undefined || isNaN(id)) {
        throw new Error("Invalid ID");
      }
      const transcription = await prisma.transcription.delete({
        where: {
          id: id
        }
      });
      return res.status(201).json({ data: transcription });
    } catch (error: any) {
      return res.status(400).json({ error: "Internal Server Error", details: error.message });
    }
  });

  return router;
};

export default TranscriptionRouter;