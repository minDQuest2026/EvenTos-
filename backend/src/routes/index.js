import { Router } from "express";
import authRoutes from "./authRoutes.js";
import audienceRoutes from "./audienceRoutes.js";
import gateRoutes from "./gateRoutes.js";

const apiRouter = Router();

apiRouter.use("/dev", authRoutes);
apiRouter.use("/audience", audienceRoutes);
apiRouter.use("/gate", gateRoutes);

export default apiRouter;
