import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkflowRunEntity } from '../database/entities/workflow-run.entity';
import { WorkflowStepRunEntity } from '../database/entities/workflow-step-run.entity';
import { EventBusService } from './event-bus.service';
import { WorkflowController } from './workflow.controller';
import { WorkflowService } from './workflow.service';

@Module({
  imports: [TypeOrmModule.forFeature([WorkflowRunEntity, WorkflowStepRunEntity])],
  controllers: [WorkflowController],
  providers: [EventBusService, WorkflowService],
  exports: [EventBusService, WorkflowService],
})
export class OrchestrationModule {}
