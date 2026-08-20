import { EmployeeHomeV1Schema } from "@evaluation/contracts/employee-experience";
import { EvaluationFactViewSchema } from "@evaluation/contracts/evaluation-fact-view";
import { EmployeeInsightsV1Schema } from "@evaluation/contracts/insights";

export const publicContractSchemas = [
  EmployeeHomeV1Schema,
  EvaluationFactViewSchema,
  EmployeeInsightsV1Schema,
];
