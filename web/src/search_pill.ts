import assert from "minimalistic-assert";

import {Filter} from "./filter";
import * as input_pill from "./input_pill";
import type {InputPillContainer} from "./input_pill";
import * as people from "./people";
import type {User} from "./people";
import type {NarrowTerm} from "./state_data";
import * as user_status from "./user_status";
import type {UserStatusEmojiInfo} from "./user_status";

type SearchUserPill = {
    type: "search_user";
    operator: string;
    display_value: string;
    negated: boolean;
    users: {
        display_value: string;
        user_id: number;
        email: string;
        img_src: string;
        status_emoji_info: UserStatusEmojiInfo | undefined;
        should_add_guest_user_indicator: boolean;
        deactivated: boolean;
    }[];
};

type SearchPill =
    | {
          type: "search";
          display_value: string;
          description_html: string;
      }
    | SearchUserPill;

export type SearchPillWidget = InputPillContainer<SearchPill>;

export function create_item_from_search_string(search_string: string): SearchPill {
    const search_terms = Filter.parse(search_string);
    const description_html = Filter.search_description_as_html(search_terms);
    return {
        display_value: search_string,
        type: "search",
        description_html,
    };
}

export function get_search_string_from_item(item: SearchPill): string {
    return item.display_value;
}

export function create_pills($pill_container: JQuery): SearchPillWidget {
    const pills = input_pill.create({
        $container: $pill_container,
        create_item_from_text: create_item_from_search_string,
        get_text_from_item: get_search_string_from_item,
        split_text_on_comma: false,
    });
    return pills;
}

function append_user_pill(
    users: User[],
    pill_widget: SearchPillWidget,
    operator: string,
    negated: boolean,
): void {
    const sign = negated ? "-" : "";
    const search_string = sign + operator + ":" + users.map((user) => user.email).join(",");
    const pill_data: SearchUserPill = {
        type: "search_user",
        operator,
        display_value: search_string,
        negated,
        users: users.map((user) => ({
            display_value: user.full_name,
            user_id: user.user_id,
            email: user.email,
            img_src: people.small_avatar_url_for_person(user),
            status_emoji_info: user_status.get_status_emoji(user.user_id),
            should_add_guest_user_indicator: people.should_add_guest_user_indicator(user.user_id),
            deactivated: !people.is_person_active(user.user_id) && !user.is_inaccessible_user,
        })),
    };

    pill_widget.appendValidatedData(pill_data);
    pill_widget.clear_text();
}

const user_pill_operators = new Set(["dm", "dm-including", "sender"]);

export function set_search_bar_contents(
    search_terms: NarrowTerm[],
    pill_widget: SearchPillWidget,
    set_search_bar_text?: (text: string) => void,
): void {
    pill_widget.clear();
    let partial_pill = "";
    for (const term of search_terms) {
        if (user_pill_operators.has(term.operator) && term.operand !== "") {
            const user_emails = term.operand.split(",");
            const users = user_emails.map((email) => {
                const user = people.get_by_email(email);
                assert(user !== undefined);
                return user;
            });
            append_user_pill(users, pill_widget, term.operator, term.negated ?? false);
            continue;
        }
        const input = Filter.unparse([term]);
        // If the last term looks something like `dm:`, we
        // don't want to make it a pill, since it isn't isn't
        // a complete search term yet.
        // Instead, we keep the partial pill to the end of the
        // search box as text input, which will update the
        // typeahead to show operand suggestions.
        if (
            set_search_bar_text !== undefined &&
            input.at(-1) === ":" &&
            term.operand === "" &&
            term === search_terms.at(-1)
        ) {
            partial_pill = input;
            continue;
        }
        pill_widget.appendValue(input);
    }
    pill_widget.clear_text();
    if (set_search_bar_text !== undefined) {
        set_search_bar_text(partial_pill);
    }
}

export function get_current_search_string_for_widget(pill_widget: SearchPillWidget): string {
    const items = pill_widget.items();
    const search_strings = items.map((item) => item.display_value);
    return search_strings.join(" ");
}
