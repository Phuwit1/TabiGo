-- AlterTable
ALTER TABLE "TripPlan" ADD COLUMN     "city" VARCHAR(200);

-- CreateTable
CREATE TABLE "UserPreference" (
    "preference_id" SERIAL NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "travel_style" TEXT NOT NULL,
    "interests" TEXT[],
    "trip_length" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("preference_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserPreference_customer_id_key" ON "UserPreference"("customer_id");

-- AddForeignKey
ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "Customer"("customer_id") ON DELETE CASCADE ON UPDATE CASCADE;
