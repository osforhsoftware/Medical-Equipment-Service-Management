import { z } from "zod";



const serviceTypes = ["Repair", "Maintenance", "Calibration", "Inspection", "Installation", "Other"] as const;



const jobStatusEnum = z.enum(["scheduled", "inProgress", "partsPending", "review", "delivery", "completed"]);



const stageDetailsSchema = z

  .object({

    qa: z

      .object({

        result: z.enum(["pass", "fail"]).optional(),

        notes: z.string().trim().max(2000).optional().nullable(),

        checkedAt: z.string().optional().nullable(),

        checkedBy: z.string().optional().nullable(),

      })

      .optional(),

    delivery: z

      .object({

        method: z.string().trim().max(80).optional().nullable(),

        note: z.string().trim().max(2000).optional().nullable(),

        receivedBy: z.string().trim().max(120).optional().nullable(),

        deliveredAt: z.string().optional().nullable(),

        confirmedBy: z.string().optional().nullable(),

        courier: z
          .object({
            name: z.string().trim().max(120).optional().nullable(),
            waybill: z.string().trim().max(120).optional().nullable(),
            dispatchDate: z.string().optional().nullable(),
            estimatedDeliveryDate: z.string().optional().nullable(),
          })
          .optional()
          .nullable(),

      })

      .optional(),

  })

  .optional()

  .nullable();



export const createJobSchema = z

  .object({

    serviceRequestId: z.string().trim().optional(),

    customerId: z.string().trim().optional(),

    equipmentId: z.string().trim().optional(),

    type: z.enum(serviceTypes).optional(),

    typeOther: z.string().trim().max(100).optional().nullable(),

    engineerId: z.string().min(1, "Engineer is required"),

    scheduledFor: z.string().min(1, "Scheduled date is required"),

    status: jobStatusEnum.optional().default("scheduled"),

    progress: z.coerce.number().min(0).max(100).optional().default(0),

    additionalFields: z

      .array(

        z.object({

          label: z.string().trim().min(1).max(80),

          value: z.string().trim().max(5000).default(""),

        }),

      )

      .max(30)

      .optional()

      .nullable(),

  })

  .superRefine((data, ctx) => {

    if (data.serviceRequestId) return;

    if (!data.customerId) {

      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["customerId"], message: "Select a customer" });

    }

    if (!data.equipmentId) {

      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["equipmentId"], message: "Select equipment" });

    }

    if (!data.type) {

      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["type"], message: "Select a service type" });

    }

    if (data.type === "Other" && !data.typeOther) {

      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["typeOther"], message: "Please specify the service type" });

    }

  });



export const updateJobSchema = z.object({

  engineerId: z.string().min(1).optional(),

  scheduledFor: z.string().optional(),

  status: jobStatusEnum.optional(),

  progress: z.coerce.number().min(0).max(100).optional(),

  type: z.enum(serviceTypes).optional(),

  typeOther: z.string().trim().max(100).optional().nullable(),

  additionalFields: z

    .array(

      z.object({

        label: z.string().trim().min(1).max(80),

        value: z.string().trim().max(5000).default(""),

      }),

    )

    .max(30)

    .optional()

    .nullable(),

  stageDetails: stageDetailsSchema,

});


