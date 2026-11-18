import { env } from "process";

export default {
  datasources: {
    db: {
      url: env("DATABASE_URL"),
    },
  },
};
