import { customRef, reactive, ref, shallowRef, watchEffect } from "vue";
//#region ../../node_modules/vite-plugin-vue-tracer/dist/client/record.mjs
var KEY_IGNORE = "data-v-inspector-ignore";
var KEY_GLOBAL = "__vue_tracer__";
var _store$1 = globalThis[KEY_GLOBAL];
if (!_store$1) {
	_store$1 = {
		hasData: false,
		vnodeToPos: /* @__PURE__ */ new WeakMap(),
		fileToVNode: /* @__PURE__ */ new Map(),
		posToVNode: /* @__PURE__ */ new Map()
	};
	Object.defineProperty(globalThis, KEY_GLOBAL, {
		value: _store$1,
		configurable: true,
		enumerable: false
	});
}
function getInternalStore() {
	return _store$1;
}
function recordPosition(source, line, column, node) {
	if (!node || typeof node === "string" || typeof node === "number") return node;
	if (!_store$1.hasData) _store$1.hasData = true;
	const props = node.props ||= {};
	_store$1.vnodeToPos.set(props, [
		source,
		line,
		column
	]);
	if (!_store$1.fileToVNode.has(source)) _store$1.fileToVNode.set(source, /* @__PURE__ */ new WeakSet());
	_store$1.fileToVNode.get(source).add(props);
	if (!_store$1.posToVNode.has(source)) _store$1.posToVNode.set(source, /* @__PURE__ */ new Map());
	const lineMap = _store$1.posToVNode.get(source);
	if (!lineMap.has(line)) lineMap.set(line, /* @__PURE__ */ new Map());
	const columnMap = lineMap.get(line);
	if (!columnMap.has(column)) columnMap.set(column, /* @__PURE__ */ new WeakSet());
	columnMap.get(column).add(props);
	return node;
}
function getPositionFromVNode(node) {
	const props = node?.props;
	if (props) return _store$1.vnodeToPos.get(props);
}
var ElementTraceInfo = class {
	pos;
	vnode;
	el;
	constructor(pos, el, vnode) {
		this.vnode = vnode;
		this.pos = pos;
		this.el = el;
	}
	get filepath() {
		return this.pos[0];
	}
	get fullpath() {
		let path = this.pos[0];
		if (this.pos[1]) {
			path += `:${this.pos[1]}`;
			if (this.pos[2]) path += `:${this.pos[2]}`;
		}
		return path;
	}
	get rect() {
		return this.el?.getBoundingClientRect();
	}
	getElementsSameFile() {
		const pos = this.pos;
		const fileVNodeSet = _store$1.fileToVNode.get(pos[0]);
		if (!fileVNodeSet) return;
		return fileVNodeSet ? Array.from(document.querySelectorAll("*")).filter((e) => e !== this.el && e.__vnode?.props && fileVNodeSet.has(e.__vnode?.props)) : [];
	}
	getParent() {
		const parentVNode = this.vnode?.parent;
		const parentEl = this.el?.parentElement;
		return findTraceFromVNode(parentVNode) ?? findTraceFromElement(parentEl);
	}
	getElementsSamePosition() {
		if (typeof this.vnode?.type !== "string") return;
		const pos = this.pos;
		const posVNodeSet = _store$1.posToVNode.get(pos[0])?.get(pos[1])?.get(pos[2]);
		if (!posVNodeSet) return;
		return posVNodeSet ? Array.from(document.querySelectorAll(this.vnode.type)).filter((e) => e !== this.el && e.__vnode?.props && posVNodeSet.has(e.__vnode?.props)) : [];
	}
};
function findTraceFromElement(el) {
	if (!el) return;
	const vnode = el.__vnode;
	return findTraceFromVNode(vnode, el);
}
function findTraceFromVNode(vnode, el) {
	if (!vnode) return;
	const pos = getPositionFromVNode(vnode);
	if (!pos) return;
	return new ElementTraceInfo(pos, el ?? vnode?.el ?? void 0, vnode);
}
function findTraceAtPointer(e) {
	let elements = document.elementsFromPoint(e.x, e.y);
	const ignoreIndex = elements.findIndex((node) => node?.hasAttribute?.(KEY_IGNORE));
	if (ignoreIndex !== -1) elements = elements.slice(ignoreIndex);
	for (const el of elements) {
		const match = findTraceFromElement(el);
		if (match) return match;
	}
}
function hasData() {
	return _store$1.hasData;
}
//#endregion
//#region ../../node_modules/vite-plugin-vue-tracer/dist/client/listeners.mjs
var createNanoEvents = () => ({
	emit(event, ...args) {
		for (let callbacks = this.events[event] || [], i = 0, length = callbacks.length; i < length; i++) callbacks[i](...args);
	},
	events: {},
	on(event, cb) {
		(this.events[event] ||= []).push(cb);
		return () => {
			this.events[event] = this.events[event]?.filter((i) => cb !== i);
		};
	}
});
var lastMatchedElement = shallowRef();
var _store = getInternalStore();
var events = _store.events ||= createNanoEvents();
var isEnabled = customRef(() => {
	const value = ref(false);
	return {
		get() {
			return value.value;
		},
		set(newValue) {
			if (newValue === value.value) return;
			value.value = newValue;
			if (newValue) events.emit("enabled");
			else events.emit("disabled");
		}
	};
});
if (typeof document !== "undefined") {
	document.addEventListener("pointermove", (e) => {
		if (!isEnabled.value) return;
		const result = findTraceAtPointer({
			x: e.clientX,
			y: e.clientY
		});
		if (result?.el === lastMatchedElement.value?.el) return;
		lastMatchedElement.value = result;
		events.emit("hover", result, e);
	});
	document.addEventListener("click", (e) => {
		if (!isEnabled.value) return;
		const result = findTraceAtPointer({
			x: e.clientX,
			y: e.clientY
		});
		if (result) {
			events.emit("click", result, e);
			e.preventDefault();
			e.stopPropagation();
			e.stopImmediatePropagation();
			return false;
		}
	}, true);
}
//#endregion
//#region ../../node_modules/vite-plugin-vue-tracer/dist/client/overlay.mjs
var state = reactive({
	isEnabled,
	isVisible: false,
	isFocused: false,
	isAnimated: true,
	sub: {}
});
var ANIMATE_DURATION = "0.15s";
var PADDING_FOCUSED = 10;
function createOverlay() {
	const overlay = document.createElement("div");
	overlay.id = "vue-tracer-overlay";
	Object.assign(overlay.style, {
		position: "fixed",
		top: "0",
		left: "0",
		bottom: "0",
		right: "0",
		zIndex: "999999",
		pointerEvents: "none",
		opacity: "0"
	});
	const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	Object.assign(svg.style, {
		position: "fixed",
		top: "0",
		left: "0",
		bottom: "0",
		pointerEvents: "none",
		right: "0"
	});
	svg.setAttribute("width", "100%");
	svg.setAttribute("height", "100%");
	const mainText = document.createElement("div");
	Object.assign(mainText.style, {
		position: "fixed",
		top: "0",
		left: "0",
		transition: `all ${ANIMATE_DURATION}`,
		backgroundColor: "#197",
		color: "#fff",
		borderBottomLeftRadius: "4px",
		borderBottomRightRadius: "4px",
		padding: "1px 4px",
		pointerEvents: "none",
		fontSize: "10px",
		fontFamily: "monospace",
		display: "flex",
		gap: "0.25rem",
		boxShadow: "0 0 2px rgba(0,0,0,0.2)"
	});
	const mainTextTag = document.createElement("div");
	const mainTextPath = document.createElement("div");
	Object.assign(mainTextPath.style, {
		opacity: "0.75",
		fontSize: "9px"
	});
	mainText.appendChild(mainTextTag);
	mainText.appendChild(mainTextPath);
	const mainRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
	mainRect.setAttribute("fill", "#1972");
	mainRect.setAttribute("stroke", "#197");
	mainRect.setAttribute("rx", "4");
	mainRect.setAttribute("ry", "4");
	overlay.appendChild(svg);
	overlay.appendChild(mainText);
	svg.appendChild(mainRect);
	document.body.appendChild(overlay);
	watchEffect(() => {
		overlay.style.transition = state.isAnimated ? `all ${ANIMATE_DURATION}` : "none";
		mainText.style.transition = state.isAnimated ? `all ${ANIMATE_DURATION}` : "none";
		mainRect.style.transition = state.isAnimated ? `all ${ANIMATE_DURATION}` : "none";
		overlay.style.opacity = state.isVisible ? "1" : "0";
	});
	watchEffect(() => {
		if (state.main && state.mainRect) {
			const rect = state.mainRect;
			mainRect.style.opacity = "1";
			if (state.isFocused) {
				mainRect.setAttribute("rx", "8");
				mainRect.setAttribute("ry", "8");
				mainRect.setAttribute("x", String(rect.left - PADDING_FOCUSED));
				mainRect.setAttribute("y", String(rect.top - PADDING_FOCUSED));
				mainRect.setAttribute("width", String(rect.width + 20));
				mainRect.setAttribute("height", String(rect.height + 20));
				mainRect.style.filter = "blur(1px)";
			} else {
				mainRect.setAttribute("rx", "4");
				mainRect.setAttribute("ry", "4");
				mainRect.setAttribute("x", String(rect.left));
				mainRect.setAttribute("y", String(rect.top));
				mainRect.setAttribute("width", String(rect.width));
				mainRect.setAttribute("height", String(rect.height));
				mainRect.style.filter = "";
			}
			mainRect.style.fill = state.isFocused ? "transparent" : "#1972";
			mainText.style.opacity = state.isFocused ? "0" : "1";
			mainTextTag.textContent = "";
			let tagName = "";
			if (state.main?.vnode?.type) {
				if (typeof state.main?.vnode?.type === "string") tagName = state.main.vnode.type;
				else tagName = state.main.vnode.type.name;
			}
			mainTextTag.textContent = tagName ? `<${tagName}>` : "";
			mainTextPath.textContent = `${state.main.pos[0]}:${state.main.pos[1]}:${state.main.pos[2]}`;
			Object.assign(mainText.style, {
				left: `${rect.left + 3}px`,
				top: `${rect.top + rect.height - 1}px`
			});
		} else {
			mainText.style.opacity = "0";
			mainRect.style.opacity = "0";
		}
	});
	const subMap = /* @__PURE__ */ new Map();
	watchEffect(() => {
		const toRemove = new Set(subMap.keys());
		for (const { id, rect } of state.sub.rects || []) {
			toRemove.delete(id);
			let cover = subMap.get(id);
			if (!cover) {
				cover = document.createElementNS("http://www.w3.org/2000/svg", "rect");
				cover.setAttribute("fill", "#8482");
				cover.setAttribute("stroke", "#848");
				cover.setAttribute("rx", "4");
				cover.setAttribute("ry", "4");
				svg.appendChild(cover);
				subMap.set(id, cover);
			}
			cover.style.transition = state.isAnimated ? `all ${ANIMATE_DURATION}` : "none";
			cover.setAttribute("x", String(rect.left));
			cover.setAttribute("y", String(rect.top));
			cover.setAttribute("width", String(rect.width));
			cover.setAttribute("height", String(rect.height));
			cover.style.opacity = "1";
		}
		for (const id of toRemove) {
			const cover = subMap.get(id);
			if (cover) {
				cover.style.opacity = "0";
				setTimeout(() => cover.remove(), 300);
				subMap.delete(id);
			}
		}
	});
}
var elementId = /* @__PURE__ */ new WeakMap();
function getElementId(el) {
	let id = elementId.get(el);
	if (!id) {
		id = Math.random().toString(16).slice(2);
		elementId.set(el, id);
	}
	return id;
}
function update(result) {
	if (!result) {
		state.isVisible = false;
		state.sub.rects = void 0;
		state.main = void 0;
		state.mainRect = void 0;
		return;
	}
	state.isVisible = true;
	state.main = result;
	state.mainRect = result.rect;
	const samePos = result.getElementsSamePosition();
	state.sub.rects = samePos?.map((el) => ({
		id: getElementId(el),
		rect: el.getBoundingClientRect()
	}));
}
function init() {
	createOverlay();
	events.on("hover", (result) => {
		update(result);
	});
	document.addEventListener("scroll", () => {
		if (state.isVisible) update(lastMatchedElement.value);
	});
	window.addEventListener("resize", () => {
		if (state.isVisible) update(lastMatchedElement.value);
	});
}
init();
//#endregion
export { ElementTraceInfo, events, findTraceAtPointer, findTraceFromElement, findTraceFromVNode, getInternalStore, hasData, isEnabled, lastMatchedElement, recordPosition, state };
