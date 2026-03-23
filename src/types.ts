export interface StepData {
  id: number;
  title: string;
  description: string;
  inputLabel?: string;
  placeholder?: string;
  alternativePath: {
    condition: string;
    suggestion: string;
  };
}

export interface UserProgress {
  currentStep: number;
  maxStepReached: number;
  theme: {
    keyword: string;
    description: string;
  };
  practitioners: string[];
  activities: string[];
  products: string[];
  coCreation: Record<string, string>;
  isAlternativePathActive: boolean[];
}

export const STEPS: StepData[] = [
  {
    id: 1,
    title: "第一步：梳理主题",
    description: "写下一个主题关键词，以及对这个关键词的描述。这是你社群的灵魂。",
    inputLabel: "主题关键词与描述",
    placeholder: "例如：#数字游民 - 探索地理位置无关的工作与生活方式...",
    alternativePath: {
      condition: "如果你的主题还不清晰或无法完成",
      suggestion: "去看看别人是怎么做的，或者从现有的社群案例中寻找灵感。"
    }
  },
  {
    id: 2,
    title: "第二步：链接实践者",
    description: "有了主题之后，罗列你身边和这个主题相关的实践者。",
    inputLabel: "身边的实践者",
    placeholder: "列出你认识的、在这个领域有实际行动的人...",
    alternativePath: {
      condition: "如果没有相关的实践者...",
      suggestion: "去参加市场上相关主题的活动，主动去链接这些实践者，建立初步联系。"
    }
  },
  {
    id: 3,
    title: "第三步：组织活动",
    description: "组织主题相关的活动，把相关的实践者聚集起来，开展体验和交流，形成主题相关的实践者社群。",
    inputLabel: "活动环节",
    placeholder: "描述活动的各个环节，例如：1. 自我介绍...",
    alternativePath: {
      condition: "如果组织活动有障碍...",
      suggestion: "可以学习“朋友的朋友局”的组织方法，或者参与朋友局发展促进小组，从轻量化社交开始。"
    }
  },
  {
    id: 4,
    title: "第四步：产品梳理",
    description: "梳理你是否有和这个主题相关的产品。产品是价值交换的载体，也是经济可持续的基础。",
    inputLabel: "相关产品",
    placeholder: "你自己开发的课程、服务或实物产品...",
    alternativePath: {
      condition: "如果你还没有原创产品...",
      suggestion: "可以先从代理或分销其他人的成熟产品开始，在服务中积累经验。"
    }
  },
  {
    id: 5,
    title: "第五步：共创与转化",
    description: "发展实践者成为共创伙伴，发起联名活动，扩大影响力，吸引更多的社群成员。",
    inputLabel: "共创矩阵",
    placeholder: "引导用户思考共创可能",
    alternativePath: {
      condition: "如果共创行动没有相关的流量支持",
      suggestion: "可以参与“行动者网络”，获得一定的流量支持，进而转发和赋能你的共创伙伴。"
    }
  }
];
