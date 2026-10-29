import { mount } from "@vue/test-utils";
import type { VueWrapper } from "@vue/test-utils";
import { nextTick } from "vue";
import { describe, expect, it } from "vitest";
import { DouCalendarView } from "../../../index";

function make(props: Record<string, unknown> = {}) {
  const wrapper: VueWrapper = mount(DouCalendarView, {
    props: {
      modelValue: "2026-10-08",
      "onUpdate:modelValue": (value: string | null | undefined) =>
        wrapper.setProps({ modelValue: value }),
      ...props,
    },
    attachTo: document.body,
  });
  return wrapper;
}

const chosen = (wrapper: VueWrapper) => (wrapper.props() as { modelValue?: string }).modelValue;

const day = (wrapper: VueWrapper, date: string) => wrapper.get(`[data-date="${date}"]`);

describe("DouCalendarView", () => {
  it("lays out six weeks of the month, starting on Monday in Chinese", () => {
    const wrapper = make();
    expect(wrapper.get(".dou-calendar-view__title").text()).toBe("2026年10月");
    const days = wrapper.findAll('[role="gridcell"]');
    expect(days).toHaveLength(42);
    expect(days[0]!.attributes("data-date")).toBe("2026-09-28");
    expect(day(wrapper, "2026-09-30").classes()).toContain("is-outside");
    expect(day(wrapper, "2026-10-08").attributes("aria-selected")).toBe("true");
    expect(day(wrapper, "2026-10-08").attributes("tabindex")).toBe("0");
    wrapper.unmount();
  });

  it("lists events by day, folding the rest", () => {
    const wrapper = make({
      maxEvents: 2,
      events: [
        { date: "2026-10-12", title: "评审" },
        { date: "2026-10-12", title: "发版", tone: "success" },
        { date: "2026-10-12", title: "周会" },
        { date: "2026-10-20", end: "2026-10-22", title: "出差", tone: "warning" },
      ],
    });
    const busy = day(wrapper, "2026-10-12");
    expect(busy.findAll(".dou-calendar-view__event").map((event) => event.text())).toEqual([
      "评审",
      "发版",
    ]);
    expect(busy.get(".dou-calendar-view__more").text()).toBe("还有 1 项");
    expect(busy.attributes("aria-label")).toContain("3 项日程");

    const span = ["2026-10-20", "2026-10-21", "2026-10-22"].map((date) =>
      day(wrapper, date).get(".dou-calendar-view__event").classes(),
    );
    expect(span[0]).toContain("is-start");
    expect(span[1]).not.toContain("is-start");
    expect(span[1]).not.toContain("is-end");
    expect(span[2]).toContain("is-end");
    wrapper.unmount();
  });

  it("chooses a day and reports event clicks without choosing", async () => {
    const wrapper = make({ events: [{ date: "2026-10-12", title: "评审" }] });
    await day(wrapper, "2026-10-15").trigger("click");
    expect(chosen(wrapper)).toBe("2026-10-15");
    expect(wrapper.emitted("select")?.[0]).toEqual(["2026-10-15"]);

    await wrapper.get(".dou-calendar-view__event").trigger("click");
    expect(wrapper.emitted("eventClick")?.[0]?.[0]).toMatchObject({ title: "评审" });
    expect(chosen(wrapper)).toBe("2026-10-15");
    wrapper.unmount();
  });

  it("moves with the keyboard and turns the month", async () => {
    const wrapper = make();
    const grid = wrapper.get('[role="grid"]');
    await grid.trigger("keydown", { key: "ArrowDown" });
    await nextTick();
    expect(document.activeElement?.getAttribute("data-date")).toBe("2026-10-15");
    await grid.trigger("keydown", { key: "PageDown" });
    await nextTick();
    expect(wrapper.get(".dou-calendar-view__title").text()).toBe("2026年11月");
    expect(wrapper.emitted("update:month")?.at(-1)).toEqual(["2026-11"]);
    await grid.trigger("keydown", { key: "Enter" });
    expect(chosen(wrapper)).toBe("2026-11-15");

    await wrapper.findAll(".dou-calendar-view__step")[0]!.trigger("click");
    expect(wrapper.get(".dou-calendar-view__title").text()).toBe("2026年10月");
    wrapper.unmount();
  });

  it("skips disabled days", async () => {
    const wrapper = make({ disabledDate: (date: string) => date.endsWith("-16") });
    await day(wrapper, "2026-10-16").trigger("click");
    expect(chosen(wrapper)).toBe("2026-10-08");
    expect(day(wrapper, "2026-10-16").attributes("aria-disabled")).toBe("true");
    wrapper.unmount();
  });

  it("shows a week on a time axis with an all-day row", async () => {
    const wrapper = make({
      view: "week",
      hours: [8, 20],
      events: [
        { date: "2026-10-06", end: "2026-10-07", title: "出差" },
        { date: "2026-10-08", time: "10:00", endTime: "11:30", title: "评审" },
        { date: "2026-10-08", time: "10:30", title: "同步" },
      ],
    });
    expect(wrapper.get(".dou-calendar-view__title").text()).toBe("2026年10月5日 – 10月11日");
    const heads = wrapper.findAll(".dou-calendar-view__column-head");
    expect(heads).toHaveLength(7);
    expect(heads[0]!.attributes("data-date")).toBe("2026-10-05");
    expect(
      wrapper.findAll(".dou-calendar-view__all-day-cell .dou-calendar-view__event"),
    ).toHaveLength(2);

    const timed = wrapper.findAll(".dou-calendar-view__timed");
    expect(timed).toHaveLength(2);
    expect(timed[0]!.attributes("aria-label")).toBe("评审, 10:00–11:30");
    expect(timed[0]!.attributes("style")).toContain("--dou-calendar-view-from: 2");
    expect(timed[1]!.attributes("style")).toContain("--dou-calendar-view-column: 1");

    await timed[1]!.trigger("click");
    expect(wrapper.emitted("eventClick")?.[0]?.[0]).toMatchObject({ title: "同步" });

    const columns = wrapper.findAll(".dou-calendar-view__column");
    await columns[3]!.trigger("click", { clientY: 100 });
    expect(wrapper.emitted("timeClick")?.[0]).toEqual([{ date: "2026-10-08", time: "10:00" }]);
    wrapper.unmount();
  });

  it("steps by week or day and switches views", async () => {
    const wrapper = make({
      view: "week",
      views: ["month", "week", "day"],
      "onUpdate:view": (value: string) => wrapper.setProps({ view: value }),
    });
    const [prev, next] = wrapper.findAll(".dou-calendar-view__step");
    expect(prev!.attributes("aria-label")).toBe("上一周");
    await next!.trigger("click");
    expect(wrapper.find('[data-date="2026-10-12"]').exists()).toBe(true);

    const options = wrapper.findAll(".dou-segmented-control input");
    expect(wrapper.get(".dou-segmented-control").text()).toBe("月周日");
    await options[2]!.setValue(true);
    expect(wrapper.emitted("update:view")?.at(-1)).toEqual(["day"]);
    expect(wrapper.findAll(".dou-calendar-view__column-head")).toHaveLength(1);
    expect(wrapper.findAll(".dou-calendar-view__step")[1]!.attributes("aria-label")).toBe("后一天");
    wrapper.unmount();
  });
});
