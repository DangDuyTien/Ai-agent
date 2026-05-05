Đây là kế hoạch triển khai và danh sách các file sẽ được tạo hoặc sửa cho các tác vụ đã cho.

---

### Kế hoạch triển khai tổng quan

Dự án hiện tại là một AI agent, tập trung vào việc tạo, quản lý và thực thi các dự án một cách linh hoạt. Các tác vụ được giao đều xoay quanh việc phát triển các khả năng cốt lõi của agent này: phân tích codebase, thiết kế blueprint dự án, và định nghĩa hợp đồng thực thi cho các tác vụ của chính agent.

Chúng tôi sẽ ưu tiên sử dụng TypeScript và cấu trúc Next.js/React hiện có, thêm các module chức năng mới vào thư mục `lib` hoặc `utils` và tích hợp chúng thông qua các API route hiện có hoặc mới khi cần thiết. Mục tiêu là tạo ra những thay đổi nhỏ nhất nhưng đủ để đạt được tiêu chí nghiệm thu của từng tác vụ.

---

### Tác vụ 1: Rà soát tác động lên codebase hiện có

**Mục tiêu:** Xác định file/module cần sửa trong repo hiện có trước khi thay đổi code.
**Giải thích:** Để thực hiện "rà soát tác động lên codebase hiện có", agent cần một cơ chế để phân tích ngữ cảnh của một yêu cầu mới so với cấu trúc và nội dung của codebase. Điều này có thể được thực hiện bằng cách mở rộng chức năng phân tích hiện có hoặc tạo một module phân tích chuyên biệt hơn. Kết quả rà soát sẽ là một danh sách các file/module tiềm năng bị ảnh hưởng.

**Giả định:**
*   Chức năng "Phân tích theo ngữ cảnh" hiện có sẽ được tận dụng hoặc mở rộng.
*   Kết quả phân tích tác động sẽ được lưu trữ hoặc trả về thông qua API.

**Các file sẽ tạo/sửa:**

1.  **`lib/codebase-analysis/impact-analyzer.ts` (Tạo mới)**
    *   **Mục đích:** Chứa logic cốt lõi để phân tích một ý tưởng hoặc yêu cầu và đối chiếu nó với cấu trúc codebase hiện có (bao gồm tên file, đường dẫn, có thể là nội dung file thô). Module này sẽ trả về một danh sách các đường dẫn file hoặc module có khả năng bị ảnh hưởng.
    *   **Nội dung dự kiến:**
        ```typescript
        // lib/codebase-analysis/impact-analyzer.ts
        import { ProjectContext } from '../types'; // Cần định nghĩa ProjectContext nếu chưa có

        export interface CodebaseImpact {
            potentiallyAffectedFiles: string[];
            rationale: string;
            // Có thể thêm các metric khác như estimatedEffort, complexity, v.v.
        }

        /**
         * Phân tích ngữ cảnh dự án và ý tưởng để xác định các file bị tác động.
         * @param projectContext Ngữ cảnh của dự án (cấu trúc file, nội dung tóm tắt).
         * @param newIdea Ý tưởng hoặc yêu cầu mới cần đánh giá tác động.
         * @returns Một đối tượng CodebaseImpact.
         */
        export async function analyzeCodebaseImpact(
            projectContext: ProjectContext,
            newIdea: string
        ): Promise<CodebaseImpact> {
            // Logic để quét projectContext (danh sách file, thư mục)
            // và so sánh với keywords/intent từ newIdea.
            // Ví dụ:
            const affectedFiles: string[] = [];
            // ... (implement logic here, có thể dùng AI model hoặc regex/keyword matching đơn giản ban đầu)
            if (newIdea.includes("backend API")) {
                affectedFiles.push("app/api/**/*.ts");
            }
            if (newIdea.includes("frontend UI")) {
                affectedFiles.push("app/**/*.tsx");
                affectedFiles.push("app/globals.css");
            }
            // Lấy danh sách file codebase có sẵn từ projectContext hoặc truy cập trực tiếp
            // (giả sử có thể truy cập danh sách file quan trọng đã cung cấp)
            const importantFiles = [
                "app/api/projects/[projectId]/analyze/route.ts",
                "app/layout.tsx",
                "app/page.tsx",
                "package.json",
                // ...
            ];
            // Ví dụ đơn giản: tìm file có chứa keyword từ newIdea hoặc liên quan
            const keyword = newIdea.split(' ')[0].toLowerCase(); // Lấy từ khóa đầu tiên
            importantFiles.forEach(file => {
                if (file.toLowerCase().includes(keyword) && !affectedFiles.includes(file)) {
                    affectedFiles.push(file);
                }
            });


            return {
                potentiallyAffectedFiles: Array.from(newFiles), // Tránh trùng lặp
                rationale: `Phân tích dựa trên các từ khóa và cấu trúc dự án.`,
            };
        }
        ```
2.  **`app/api/projects/[projectId]/analyze/route.ts` (Sửa đổi)**
    *   **Mục đích:** Cập nhật API route hiện có để chấp nhận một yêu cầu phân tích tác động và sử dụng `impact-analyzer.ts` để thực hiện phân tích.
    *   **Nội dung dự kiến:** Thêm một endpoint hoặc một nhánh logic trong endpoint `analyze` để xử lý yêu cầu "codebase_impact_analysis".
    *   **Ví dụ:**
        ```typescript
        // app/api/projects/[projectId]/analyze/route.ts
        import { NextResponse } from 'next/server';
        import { analyzeCodebaseImpact } from '../../../../../lib/codebase-analysis/impact-analyzer';
        // ... các import khác

        export async function POST(
            request: Request,
            { params }: { params: { projectId: string } }
        ) {
            const { projectId } = params;
            const { analysisType, payload } = await request.json();

            if (analysisType === 'codebase_impact_analysis') {
                // Lấy ngữ cảnh dự án từ đâu đó (DB, filesystem, cache)
                // Đây là một giả định quan trọng: làm thế nào để có được ProjectContext
                // Giả định đơn giản: context có thể là danh sách các file quan trọng hiện có
                const projectContext = {
                    fileList: [
                        "app/api/projects/[projectId]/analyze/route.ts",
                        "app/layout.tsx",
                        "app/page.tsx",
                        "package.json",
                        // ... các file quan trọng từ ngữ cảnh codebase
                    ]
                    // Thêm các thông tin khác cần thiết
                };
                const newIdea = payload.idea; // payload chứa ý tưởng cần rà soát
                const impact = await analyzeCodebaseImpact(projectContext, newIdea);
                return NextResponse.json(impact);
            }

            // ... xử lý các loại phân tích khác nếu có
            return NextResponse.json({ message: 'Analysis type not supported' }, { status: 400 });
        }
        ```
3.  **`lib/types.ts` hoặc `lib/project-context/types.ts` (Tạo mới nếu chưa có hoặc sửa đổi)**
    *   **Mục đích:** Định nghĩa các kiểu dữ liệu cho `ProjectContext` và các cấu trúc liên quan để phục vụ phân tích.
    *   **Nội dung dự kiến:**
        ```typescript
        // lib/types.ts
        export interface ProjectContext {
            fileList: string[]; // Danh sách các đường dẫn file trong dự án
            // Có thể thêm contentSummaries: Record<string, string>;
            // Hoặc projectDescription: string;
            // ...
        }
        ```

**Cách kiểm chứng kết quả:**
*   Chạy `npm run dev`.
*   Sử dụng một công cụ như Postman hoặc `curl` để gửi yêu cầu POST đến `/api/projects/[projectId]/analyze` với `analysisType: "codebase_impact_analysis"` và một `payload` chứa `idea`.
*   Kiểm tra phản hồi JSON, đảm bảo nó chứa `potentiallyAffectedFiles` và `rationale` hợp lý.
    *   Ví dụ:
        ```bash
        curl -X POST -H "Content-Type: application/json" -d '{
            "analysisType": "codebase_impact_analysis",
            "payload": {
                "idea": "thêm một tính năng quản lý người dùng mới"
            }
        }' http://localhost:3000/api/projects/some-project-id/analyze
        ```

---

### Tác vụ 2: Hoàn thiện blueprint dự án

**Mục tiêu:** Tổng hợp ý định, yêu cầu và chức năng thành blueprint cho dự án chưa rõ loại.
**Giải thích:** Tác vụ này yêu cầu tạo ra một cấu trúc blueprint rõ ràng và một cách để điền thông tin vào cấu trúc đó dựa trên ý tưởng thô. API `blueprint` hiện có sẽ là cổng để tạo hoặc cập nhật blueprint này.

**Giả định:**
*   API `app/api/projects/[projectId]/blueprint/route.ts` sẽ được sử dụng để quản lý blueprint.
*   Blueprint sẽ được lưu trữ (tạm thời hoặc vĩnh viễn) liên quan đến `projectId`.

**Các file sẽ tạo/sửa:**

1.  **`lib/project-blueprint/types.ts` (Tạo mới)**
    *   **Mục đích:** Định nghĩa giao diện TypeScript cho cấu trúc blueprint dự án.
    *   **Nội dung dự kiến:**
        ```typescript
        // lib/project-blueprint/types.ts
        export enum ProjectType {
            Unknown = "Unknown",
            WebFrontend = "Web Frontend",
            BackendAPI = "Backend API",
            CLI_Tool = "CLI Tool",
            AI_Agent_Extension = "AI Agent Extension",
            // Thêm các loại dự án khác khi cần
        }

        export interface ProjectBlueprint {
            id: string; // project ID
            projectType: ProjectType;
            targetUsers: string[];
            problem: string;
            goals: string[];
            constraints: string[];
            coreFeatures: string[]; // Chức năng cốt lõi đề xuất
            missingQuestions?: string[]; // Nếu còn thiếu thông tin
            createdAt: Date;
            updatedAt: Date;
        }
        ```
2.  **`lib/project-blueprint/generator.ts` (Tạo mới)**
    *   **Mục đích:** Chứa logic để phân tích một "ý tưởng thô" và tạo ra một `ProjectBlueprint` dựa trên các trường yêu cầu. Module này có thể dùng heuristic hoặc kết hợp với mô hình ngôn ngữ lớn (nếu tích hợp) để suy luận các trường như `projectType`, `targetUsers`, v.v.
    *   **Nội dung dự kiến:**
        ```typescript
        // lib/project-blueprint/generator.ts
        import { ProjectBlueprint, ProjectType } from './types';

        /**
         * Tạo một blueprint dự án từ ý tưởng thô và ngữ cảnh.
         * @param projectId ID của dự án.
         * @param rawIdea Ý tưởng thô của dự án.
         * @returns Một ProjectBlueprint đã được điền thông tin.
         */
        export async function generateProjectBlueprint(
            projectId: string,
            rawIdea: string
        ): Promise<ProjectBlueprint> {
            // Giả định một số logic đơn giản để điền blueprint từ rawIdea
            let projectType = ProjectType.Unknown;
            let targetUsers: string[] = ["Người dùng cuối", "Người quản lý sản phẩm"];
            let problem = "Người dùng cần một dự án chưa rõ loại để giải quyết nhu cầu trong ý tưởng: " + rawIdea;
            let goals: string[] = ["Biến ý tưởng thành kế hoạch thực thi", "Xác định các cải thiện"];
            let constraints: string[] = ["Sử dụng stack hiện có (Next.js, React)", "Ưu tiên diff nhỏ"];
            let coreFeatures: string[] = [];
            let missingQuestions: string[] = [];

            // Logic suy luận (có thể phức tạp hơn với LLM)
            if (rawIdea.includes("AI agent")) {
                projectType = ProjectType.AI_Agent_Extension;
            } else if (rawIdea.includes("giao diện web")) {
                projectType = ProjectType.WebFrontend;
            }
            if (rawIdea.includes("cải thiện") || rawIdea.includes("rà soát")) {
                coreFeatures.push("Phân tích theo ngữ cảnh");
                coreFeatures.push("Đề xuất chức năng động");
            }

            // Tiêu chí nghiệm thu yêu cầu không quá 3 câu hỏi thiếu
            if (rawIdea.length < 20) { // Ví dụ heuristic cho ý tưởng quá ngắn
                 missingQuestions.push("Mục tiêu cụ thể của việc rà soát là gì?");
                 missingQuestions.push("Những loại cải thiện nào được ưu tiên?");
            }

            return {
                id: projectId,
                projectType,
                targetUsers,
                problem,
                goals,
                constraints,
                coreFeatures,
                missingQuestions: missingQuestions.length > 0 ? missingQuestions : undefined,
                createdAt: new Date(),
                updatedAt: new Date(),
            };
        }
        ```
3.  **`app/api/projects/[projectId]/blueprint/route.ts` (Sửa đổi)**
    *   **Mục đích:** Cập nhật API route hiện có để xử lý yêu cầu POST/PUT tạo/cập nhật blueprint, sử dụng `generator.ts`.
    *   **Nội dung dự kiến:** Endpoint này sẽ nhận một `rawIdea` và trả về `ProjectBlueprint`.
    *   **Ví dụ:**
        ```typescript
        // app/api/projects/[projectId]/blueprint/route.ts
        import { NextResponse } from 'next/server';
        import { generateProjectBlueprint } from '../../../../../lib/project-blueprint/generator';
        import { ProjectBlueprint } from '../../../../../lib/project-blueprint/types';

        // Giả định nơi lưu trữ blueprint (thực tế sẽ là DB/file system)
        const blueprints: Record<string, ProjectBlueprint> = {};

        export async function POST(
            request: Request,
            { params }: { params: { projectId: string } }
        ) {
            const { projectId } = params;
            const { rawIdea } = await request.json();

            if (!rawIdea) {
                return NextResponse.json({ message: 'Missing rawIdea' }, { status: 400 });
            }

            const blueprint = await generateProjectBlueprint(projectId, rawIdea);
            blueprints[projectId] = blueprint; // Lưu blueprint tạm thời

            return NextResponse.json(blueprint);
        }

        export async function GET(
            request: Request,
            { params }: { params: { projectId: string } }
        ) {
            const { projectId } = params;
            const blueprint = blueprints[projectId];
            if (!blueprint) {
                return NextResponse.json({ message: 'Blueprint not found' }, { status: 404 });
            }
            return NextResponse.json(blueprint);
        }
        ```

**Cách kiểm chứng kết quả:**
*   Chạy `npm run dev`.
*   Sử dụng Postman hoặc `curl` để gửi yêu cầu POST đến `/api/projects/[projectId]/blueprint` với `rawIdea`.
*   Kiểm tra phản hồi JSON để đảm bảo nó khớp với cấu trúc `ProjectBlueprint` và các trường đã được điền hợp lý. Đặc biệt, kiểm tra `missingQuestions` không quá 3 câu.
    *   Ví dụ:
        ```bash
        curl -X POST -H "Content-Type: application/json" -d '{
            "rawIdea": "rà soát lại dự án xem cần cải thiện ở đâu"
        }' http://localhost:3000/api/projects/some-project-id/blueprint
        ```
    *   Sau đó GET để kiểm tra:
        ```bash
        curl http://localhost:3000/api/projects/some-project-id/blueprint
        ```

---

### Tác vụ 3: Chuẩn bị hợp đồng thực thi

**Mục tiêu:** Định nghĩa format prompt, output và checklist đánh giá cho agent lập trình.
**Giải thích:** Tác vụ này tập trung vào việc định nghĩa một cách có cấu trúc "hợp đồng" cho các tác vụ mà agent sẽ thực thi. Điều này bao gồm format prompt mà agent sẽ nhận, cấu trúc output mà agent mong đợi, và các tiêu chí đánh giá cho kết quả đó.

**Giả định:**
*   Các hợp đồng này sẽ được lưu trữ dưới dạng định nghĩa TypeScript và có thể được tải bởi các module thực thi của agent.
*   Các API `execute` và `review` sẽ sử dụng các hợp đồng này.

**Các file sẽ tạo/sửa:**

1.  **`lib/agent/execution-contract.ts` (Tạo mới)**
    *   **Mục đích:** Định nghĩa các giao diện TypeScript cho `ExecutionContract`, bao gồm `promptFormat`, `outputFormat`, và `evaluationChecklist`.
    *   **Nội dung dự kiến:**
        ```typescript
        // lib/agent/execution-contract.ts

        /**
         * Định nghĩa format cho prompt mà agent sẽ nhận.
         */
        export interface PromptFormat {
            title: string;
            description: string;
            context: string; // Ngữ cảnh dự án, codebase, v.v.
            taskInstructions: string;
            constraints: string[];
            acceptanceCriteria: string[];
            outputExpectations: string;
        }

        /**
         * Định nghĩa cấu trúc output mà agent mong đợi.
         */
        export interface OutputFormat {
            type: 'code_changes' | 'text_report' | 'json_data' | 'blueprint_update';
            schema?: any; // JSON schema hoặc TypeScript interface description
            filePath?: string[]; // Các file dự kiến sẽ bị ảnh hưởng nếu type là code_changes
            explanation: string;
        }

        /**
         * Checklist đánh giá cho kết quả của tác vụ agent.
         */
        export interface EvaluationChecklistItem {
            id: string;
            description: string;
            isMet: boolean | null; // true/false sau khi đánh giá, null nếu chưa đánh giá
            criteria: string[]; // Tiêu chí cụ thể để đánh giá mục này
        }

        export interface ExecutionContract {
            taskId: string;
            taskTitle: string;
            taskType: string; // Ví dụ: 'codebase_impact_analysis', 'blueprint_design'
            prompt: PromptFormat;
            expectedOutput: OutputFormat;
            evaluationChecklist: EvaluationChecklistItem[];
        }
        ```
2.  **`lib/agent/contract-manager.ts` (Tạo mới)**
    *   **Mục đích:** Một module tiện ích để tạo và quản lý các `ExecutionContract` cho các loại tác vụ khác nhau. Điều này giúp tách biệt việc định nghĩa contract khỏi logic thực thi.
    *   **Nội dung dự kiến:**
        ```typescript
        // lib/agent/contract-manager.ts
        import { ExecutionContract, PromptFormat, OutputFormat, EvaluationChecklistItem } from './execution-contract';

        export function createCodebaseImpactAnalysisContract(taskId: string, projectContext: string, newIdea: string): ExecutionContract {
            const prompt: PromptFormat = {
                title: "Phân tích tác động lên codebase",
                description: `Phân tích ý tưởng "${newIdea}" và xác định các file/module cần sửa đổi trong codebase hiện có.`,
                context: projectContext,
                taskInstructions: "Liệt kê các file/module có thể bị ảnh hưởng và giải thích lý do cho từng file.",
                constraints: [
                    "Giữ cấu trúc dự án, framework, trình quản lý gói và quy ước cục bộ đang có.",
                    "Không đề xuất refactor không liên quan."
                ],
                acceptanceCriteria: [
                    "Chỉ ra file/module liên quan dựa trên ngữ cảnh codebase.",
                    "Giải thích lý do tác động cho mỗi file/module."
                ],
                outputExpectations: "Một danh sách JSON các file và lý do tác động."
            };

            const expectedOutput: OutputFormat = {
                type: 'json_data',
                schema: {
                    type: "object",
                    properties: {
                        potentiallyAffectedFiles: { type: "array", items: { type: "string" } },
                        rationale: { type: "string" }
                    },
                    required: ["potentiallyAffectedFiles", "rationale"]
                },
                explanation: "Trả về một đối tượng JSON chứa danh sách các file bị ảnh hưởng và giải thích."
            };

            const evaluationChecklist: EvaluationChecklistItem[] = [
                { id: "files_identified", description: "Tất cả các file có khả năng bị ảnh hưởng đã được xác định?", isMet: null, criteria: ["Độ bao phủ của các file được đề xuất", "Mức độ liên quan của từng file"] },
                { id: "rationale_clear", description: "Lý do tác động có rõ ràng và hợp lý không?", isMet: null, criteria: ["Độ chính xác của lý do", "Độ chi tiết của giải thích"] }
            ];

            return {
                taskId,
                taskTitle: "Rà soát tác động lên codebase hiện có",
                taskType: "codebase_impact_analysis",
                prompt,
                expectedOutput,
                evaluationChecklist,
            };
        }

        // Có thể thêm các hàm createContract khác cho các loại tác vụ khác
        // export function createBlueprintDesignContract(...) { ... }
        ```
3.  **`app/api/projects/[projectId]/execute/route.ts` (Sửa đổi)**
    *   **Mục đích:** Endpoint này có thể được sửa đổi để nhận một `taskId` và một `taskType`, sau đó sử dụng `contract-manager.ts` để lấy `ExecutionContract` phù hợp trước khi gửi prompt đến AI agent thực sự (phần này không được yêu cầu trong tác vụ hiện tại, nhưng là ngữ cảnh).
    *   **Nội dung dự kiến:**
        ```typescript
        // app/api/projects/[projectId]/execute/route.ts
        import { NextResponse } from 'next/server';
        import { createCodebaseImpactAnalysisContract } from '../../../../../lib/agent/contract-manager';
        // ... other imports

        export async function POST(
            request: Request,
            { params }: { params: { projectId: string } }
        ) {
            const { projectId } = params;
            const { taskId, taskType, taskPayload } = await request.json();

            let contract;
            if (taskType === 'codebase_impact_analysis') {
                // Giả định projectContext cần được lấy từ đâu đó
                const projectContext = "Ngữ cảnh của dự án AI-agent..."; // Tạm thời
                contract = createCodebaseImpactAnalysisContract(taskId, projectContext, taskPayload.idea);
            } else {
                return NextResponse.json({ message: 'Unknown task type' }, { status: 400 });
            }

            // Ở đây, 'contract' có thể được sử dụng để tạo prompt thực tế cho một LLM
            // và xác định cách xử lý output.
            console.log("Generated Execution Contract:", contract);

            // Giả lập việc gửi đến agent và nhận phản hồi
            return NextResponse.json({
                message: "Execution contract prepared and (simulated) sent to agent.",
                contract: {
                    taskId: contract.taskId,
                    taskType: contract.taskType,
                    promptTitle: contract.prompt.title,
                    expectedOutputType: contract.expectedOutput.type,
                    checklistItemsCount: contract.evaluationChecklist.length
                }
            });
        }
        ```

**Cách kiểm chứng kết quả:**
*   Chạy `npm run dev`.
*   Kiểm tra sự tồn tại và cấu trúc của các file `lib/agent/execution-contract.ts` và `lib/agent/contract-manager.ts`.
*   Sử dụng Postman hoặc `curl` để gửi yêu cầu POST đến `/api/projects/[projectId]/execute` với `taskType: "codebase_impact_analysis"` và `taskPayload` chứa `idea`.
*   Kiểm tra phản hồi JSON, đảm bảo nó xác nhận rằng hợp đồng đã được chuẩn bị và chứa các thông tin tóm tắt về hợp đồng.
    *   Ví dụ:
        ```bash
        curl -X POST -H "Content-Type: application/json" -d '{
            "taskId": "task-123",
            "taskType": "codebase_impact_analysis",
            "taskPayload": {
                "idea": "thêm một tính năng ghi nhật ký mới"
            }
        }' http://localhost:3000/api/projects/some-project-id/execute
        ```

---

**Không có Dependency bổ sung được yêu cầu cho các tác vụ này.** Các thay đổi chỉ tập trung vào logic nội bộ và định nghĩa kiểu dữ liệu.