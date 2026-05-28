import { Router, type IRouter } from "express";
import healthRouter from "./health";
import invoicesRouter from "./invoices";
import exchangeRateRouter from "./exchange-rate";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/invoices", invoicesRouter);
router.use("/exchange-rates", exchangeRateRouter);

export default router;
