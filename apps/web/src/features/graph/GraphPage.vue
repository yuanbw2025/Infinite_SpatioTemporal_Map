<script setup lang="ts">
import type {
  EntityId,
  EntityType,
  KnowledgeGraphResult,
} from "@infinite-spacetime/contracts";
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import EmptyState from "../../components/EmptyState.vue";
import EntityTypeBadge from "../../components/EntityTypeBadge.vue";
import PageHeader from "../../components/PageHeader.vue";
import { useApplication } from "../../composables/use-application";

const route = useRoute();
const router = useRouter();
const { services } = useApplication();
const graph = ref<KnowledgeGraphResult>();
const query = ref("");
const loading = ref(false);
const error = ref("");
const depth = ref(1);
const activeTypes = ref<EntityType[]>([
  "person",
  "place",
  "event",
  "institution",
  "artifact",
  "site",
]);
const graphTypes: readonly EntityType[] = [
  "person",
  "place",
  "event",
  "institution",
  "artifact",
  "site",
];

const centerEntityId = computed<EntityId | undefined>(() =>
  typeof route.query.entity === "string"
    ? (route.query.entity as EntityId)
    : undefined,
);

const nodePositions = computed(() => {
  const nodes = graph.value?.nodes ?? [];
  const centerIndex = nodes.findIndex(
    (node) => node.entity.id === centerEntityId.value,
  );
  const positions = new Map<EntityId, { x: number; y: number }>();
  const radialNodes = nodes.filter((_, index) => index !== centerIndex);
  if (centerIndex >= 0) {
    positions.set(nodes[centerIndex]!.entity.id, { x: 450, y: 300 });
  }
  radialNodes.forEach((node, index) => {
    const angle =
      (Math.PI * 2 * index) / Math.max(radialNodes.length, 1) - Math.PI / 2;
    const radius = centerIndex >= 0 ? 225 : 240;
    positions.set(node.entity.id, {
      x: 450 + Math.cos(angle) * radius,
      y: 300 + Math.sin(angle) * radius,
    });
  });
  return positions;
});

function position(entityId: EntityId) {
  return nodePositions.value.get(entityId) ?? { x: 450, y: 300 };
}

async function load() {
  loading.value = true;
  error.value = "";
  try {
    graph.value = await services.graph.explore({
      ...(centerEntityId.value ? { centerEntityId: centerEntityId.value } : {}),
      ...(activeTypes.value.length ? { entityTypes: activeTypes.value } : {}),
      depth: depth.value,
      limit: 80,
    });
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : "知识图谱加载失败";
  } finally {
    loading.value = false;
  }
}

async function locateEntity() {
  const term = query.value.trim();
  if (!term) {
    await router.push({ path: "/graph" });
    return;
  }
  const page = await services.knowledge.listEntities({ text: term, limit: 20 });
  const match =
    page.items.find((item) => item.entity.preferredName === term) ??
    page.items[0];
  if (!match) {
    error.value = `没有找到“${term}”对应的实体。`;
    return;
  }
  await router.push({ path: "/graph", query: { entity: match.entity.id } });
}

watch([centerEntityId, depth, activeTypes], load, {
  immediate: true,
  deep: true,
});
</script>

<template>
  <section class="page content-page graph-page">
    <PageHeader
      eyebrow="KNOWLEDGE GRAPH"
      title="知识图谱"
      description="从带证据的实体关系展开网络；节点进入百科档案，边回到支撑它的原文。"
    >
      <template #actions>
        <form class="inline-search" @submit.prevent="locateEntity">
          <label class="filter-field filter-field--wide">
            <span>以实体为中心展开</span>
            <input
              v-model="query"
              type="search"
              placeholder="人物、地点、文物或事件"
            />
          </label>
          <button class="primary-button" type="submit">定位</button>
        </form>
      </template>
    </PageHeader>

    <div class="graph-controls">
      <label class="filter-field">
        <span>关系深度</span>
        <select v-model.number="depth">
          <option :value="1">一层关系</option>
          <option :value="2">两层关系</option>
          <option :value="3">三层关系</option>
        </select>
      </label>
      <div
        class="filter-chips graph-type-chips"
        role="group"
        aria-label="实体类型"
      >
        <label v-for="type in graphTypes" :key="type">
          <input v-model="activeTypes" type="checkbox" :value="type" />
          <EntityTypeBadge :type="type" />
        </label>
      </div>
    </div>

    <p v-if="loading" class="loading-line">正在组织实体关系……</p>
    <p v-else-if="error" class="error-line">{{ error }}</p>
    <div v-else-if="graph?.nodes.length" class="graph-layout">
      <div class="graph-canvas panel">
        <svg viewBox="0 0 900 600" role="img" aria-label="实体关系图">
          <g class="graph-edges">
            <g v-for="edge in graph.edges" :key="edge.assertionId">
              <line
                :x1="position(edge.sourceId).x"
                :y1="position(edge.sourceId).y"
                :x2="position(edge.targetId).x"
                :y2="position(edge.targetId).y"
              />
              <text
                :x="(position(edge.sourceId).x + position(edge.targetId).x) / 2"
                :y="(position(edge.sourceId).y + position(edge.targetId).y) / 2"
              >
                {{ edge.predicate }}
              </text>
            </g>
          </g>
          <router-link
            v-for="node in graph.nodes"
            :key="node.entity.id"
            class="graph-node"
            :class="{ 'graph-node--center': node.entity.id === centerEntityId }"
            :to="`/entities/${node.entity.id}`"
          >
            <circle
              :cx="position(node.entity.id).x"
              :cy="position(node.entity.id).y"
              :r="node.entity.id === centerEntityId ? 38 : 26"
              :data-type="node.entity.type"
            />
            <text
              :x="position(node.entity.id).x"
              :y="position(node.entity.id).y + 4"
            >
              {{ node.entity.preferredName }}
            </text>
          </router-link>
        </svg>
      </div>

      <aside class="graph-sidebar panel">
        <p class="section-kicker">当前网络</p>
        <strong class="graph-stat">{{ graph.nodes.length }}</strong>
        <span>个实体 · {{ graph.edges.length }} 条有据关系</span>
        <p v-if="graph.truncated" class="muted">
          网络已按规模上限截断，请搜索一个实体缩小范围。
        </p>
        <ol class="graph-connection-list">
          <li
            v-for="edge in graph.edges.slice(0, 30)"
            :key="`list-${edge.assertionId}`"
          >
            <span>{{ edge.predicate }}</span>
            <router-link :to="`/reader/${edge.evidence[0]?.passageId}`"
              >查看出处</router-link
            >
          </li>
        </ol>
      </aside>
    </div>
    <EmptyState
      v-else
      title="知识图谱引擎已经就绪"
      description="发布带 objectId 和原文证据的 Assertion 后，关系网络会自动出现，不需要再维护图谱专用数据。"
    />
  </section>
</template>
