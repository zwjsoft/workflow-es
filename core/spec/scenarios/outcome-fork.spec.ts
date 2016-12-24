import { Promise } from "es6-promise";
import { WorkflowHost, WorkflowBuilder, WorkflowStatus, WorkflowBase, StepBody, StepExecutionContext, ExecutionResult, WorkflowInstance } from "../../src";
import { MemoryPersistenceProvider } from "../../src/services/memory-persistence-provider";


var outcomeForkScope = {
    taskATicker: 0,    
    taskBTicker: 0,
    taskCTicker: 0
}

describe("multiple outcomes", () => {

    class TaskA extends StepBody {    
        public run(context: StepExecutionContext): Promise<ExecutionResult> {
            outcomeForkScope.taskATicker++;
            return ExecutionResult.resolveOutcome(true);
        }
    }

    class TaskB extends StepBody {    
        public run(context: StepExecutionContext): Promise<ExecutionResult> {
            outcomeForkScope.taskBTicker++;
            return ExecutionResult.resolveNext();
        }
    }

    class TaskC extends StepBody {    
        public run(context: StepExecutionContext): Promise<ExecutionResult> {
            outcomeForkScope.taskCTicker++;
            return ExecutionResult.resolveNext();
        }
    }

    class Outcome_Workflow implements WorkflowBase<any> {    
        public id: string = "outcome-workflow";
        public version: number = 1;

        public build(builder: WorkflowBuilder<any>) {        
            var taskA = builder.startWith(TaskA);
            
            taskA.when(false)
                .then(TaskB);
            
            taskA.when(true)
                .then(TaskC);
        }
    }

    var workflowId = null;
    var instance = null;
    var host = new WorkflowHost();
    var persistence = new MemoryPersistenceProvider();
    host.usePersistence(persistence);    
    host.useLogger(console);
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 20000;

    beforeAll((done) => {
        host.registerWorkflow(new Outcome_Workflow());
        host.start()
            .then(() => {                
                host.startWorkflow("outcome-workflow", 1)
                    .then(id => {                        
                        workflowId = id;
                        var counter = 0;
                        var callback = () => {
                            persistence.getWorkflowInstance(workflowId)
                                .then(result => {
                                    instance = result;
                                    if ((instance.status == WorkflowStatus.Runnable) && (counter < 60)) {
                                        counter++;
                                        setTimeout(callback, 500);
                                    }
                                    else {
                                        done();
                                    }
                                })
                                .catch(done.fail);                            
                        };
                        setTimeout(callback, 500);                        
                    });
            });         
    });

    afterAll(() => {
        host.stop();        
    });
    
    it("should be marked as complete", function() {
        expect(instance.status).toBe(WorkflowStatus.Complete);
    });

    it("should have executed task A once", function() {
        expect(outcomeForkScope.taskATicker).toBe(1);
    });

    it("should not have executed task B", function() {
        expect(outcomeForkScope.taskBTicker).toBe(0);
    });

    it("should have executed task C once", function() {
        expect(outcomeForkScope.taskCTicker).toBe(1);
    });



});